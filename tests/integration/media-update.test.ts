import { Mongoose, Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  MediaUpdateRepositoryConflictError,
  createMediaUpdateRepository,
} from "@/server/modules/media/repository/media-update";
import { getMediaModel } from "@/server/modules/media/model/media";
import { updateMediaMetadata } from "@/server/modules/media/service/update-media";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

describe("media metadata persistence", () => {
  let database: TestMongoDatabase;
  let client: Mongoose;
  const uploaderId = new Types.ObjectId();
  const actorId = new Types.ObjectId();
  let mediaId: string;

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-media-update-test");
    client = new Mongoose();
    await client.connect(database.uri);
    const Media = getMediaModel(client.connection);
    await Media.init();
    const media = await Media.create({
      source: "managed",
      provider: "minio",
      bucket: "private-media",
      objectKey: "originals/meal.png",
      originalName: "meal.png",
      mimeType: "image/png",
      kind: "image",
      bytes: 2_000,
      dimensions: { width: 200, height: 100 },
      checksum: "a".repeat(64),
      processingState: "ready",
      variants: [
        {
          key: "variants/meal.webp",
          mimeType: "image/webp",
          bytes: 1_000,
          dimensions: { width: 200, height: 100 },
          checksum: "b".repeat(64),
          processingState: "ready",
        },
      ],
      translations: [{ locale: "en", alt: "Meal" }],
      uploaderId,
      usageCount: 2,
    });
    mediaId = media._id.toString();
  }, 120_000);

  afterAll(async () => {
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  it("updates editable metadata and search material without changing object facts", async () => {
    const Media = getMediaModel(client.connection);
    const before = await Media.findById(mediaId).lean();
    const result = await updateMediaMetadata(createMediaUpdateRepository(client.connection), {
      id: mediaId,
      actorId: actorId.toString(),
      update: {
        originalName: "special meal.png",
        translations: [
          { locale: "en", alt: "Special Persian meal" },
          { locale: "fa", alt: "غذای ویژه" },
        ],
      },
    });
    expect(result.originalName).toBe("special meal.png");
    const after = await Media.findById(mediaId).select("+normalizedSearchText").lean();
    expect(after).toMatchObject({
      objectKey: before?.objectKey,
      bucket: before?.bucket,
      mimeType: before?.mimeType,
      bytes: before?.bytes,
      checksum: before?.checksum,
      dimensions: before?.dimensions,
      variants: before?.variants,
      uploaderId: before?.uploaderId,
      usageCount: before?.usageCount,
      updatedBy: { kind: "admin", actorId },
    });
    expect((after as unknown as { normalizedSearchText?: string })?.normalizedSearchText).toContain(
      "special persian meal",
    );
  });

  it("rejects a stale metadata snapshot with an optimistic conflict", async () => {
    const repository = createMediaUpdateRepository(client.connection);
    const first = await repository.findMetadata(mediaId);
    const stale = await repository.findMetadata(mediaId);
    if (!first || !stale) throw new Error("Missing media fixture.");
    await repository.saveMetadata(
      first,
      { translations: [{ locale: "en", alt: "First edit" }] },
      actorId.toString(),
    );
    await expect(
      repository.saveMetadata(
        stale,
        { translations: [{ locale: "en", alt: "Stale edit" }] },
        actorId.toString(),
      ),
    ).rejects.toBeInstanceOf(MediaUpdateRepositoryConflictError);
  });
});
