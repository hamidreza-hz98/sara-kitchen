import { Mongoose, Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getMediaModel } from "@/server/modules/media/model/media";
import { createMediaDeleteRepository } from "@/server/modules/media/repository/media-delete";
import { deleteMediaSafely } from "@/server/modules/media/service/delete-media";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

describe("safe media deletion persistence", () => {
  let database: TestMongoDatabase;
  let client: Mongoose;
  const uploaderId = new Types.ObjectId();
  const actorId = new Types.ObjectId();

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-media-delete-test");
    client = new Mongoose();
    await client.connect(database.uri);
    await getMediaModel(client.connection).init();
  }, 120_000);

  afterAll(async () => {
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  async function createMedia(usageCount: number) {
    const suffix = new Types.ObjectId().toString();
    return getMediaModel(client.connection).create({
      source: "managed",
      provider: "minio",
      bucket: "private-media",
      objectKey: `originals/${suffix}.png`,
      originalName: `${suffix}.png`,
      mimeType: "image/png",
      kind: "image",
      bytes: 2_000,
      dimensions: { width: 200, height: 100 },
      checksum: suffix.padEnd(64, "a"),
      processingState: "ready",
      variants: [
        {
          key: `variants/${suffix}.webp`,
          mimeType: "image/webp",
          bytes: 1_000,
          dimensions: { width: 200, height: 100 },
          checksum: suffix.padEnd(64, "b"),
          processingState: "ready",
        },
      ],
      translations: [{ locale: "en", alt: "Meal" }],
      uploaderId,
      usageCount,
    });
  }

  it("recycles unreferenced media without purging original or variant facts", async () => {
    const media = await createMedia(0);
    const deletedAt = new Date("2026-09-18T10:00:00.000Z");

    await expect(
      deleteMediaSafely(createMediaDeleteRepository(client.connection), {
        id: media._id.toString(),
        actorId: actorId.toString(),
        now: deletedAt,
      }),
    ).resolves.toMatchObject({
      id: media._id.toString(),
      deletedAt: deletedAt.toISOString(),
      purgeEligibleAt: "2026-10-18T10:00:00.000Z",
    });

    const recycled = await getMediaModel(client.connection).findById(media._id).lean();
    expect(recycled).toMatchObject({
      objectKey: media.objectKey,
      variants: [{ key: media.variants[0]?.key }],
      usageCount: 0,
      deletedAt,
      deletedBy: { kind: "admin", actorId },
      updatedBy: { kind: "admin", actorId },
    });
  });

  it("atomically blocks referenced category, dish, blog, or settings media", async () => {
    const media = await createMedia(4);

    await expect(
      deleteMediaSafely(createMediaDeleteRepository(client.connection), {
        id: media._id.toString(),
        actorId: actorId.toString(),
      }),
    ).rejects.toMatchObject({ code: "referenced", referenceCount: 4 });

    const active = await getMediaModel(client.connection).findById(media._id).lean();
    expect(active).toMatchObject({ deletedAt: null, deletedBy: null, usageCount: 4 });
  });
});
