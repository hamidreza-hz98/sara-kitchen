import { Mongoose, Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createActorMetadata } from "@/server/database/schema";
import { getMediaModel } from "@/server/modules/media/model/media";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

describe("Media persistence", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-media-model-test");
    client = new Mongoose();
    await client.connect(database.uri);
  }, 120_000);

  afterAll(async () => {
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  it("persists originals, variants, external assets, failures, and deleted items", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const Media = getMediaModel(client.connection);
    await Media.init();
    const uploaderId = new Types.ObjectId();
    const checksum = "a".repeat(64);
    const base = {
      source: "managed" as const,
      provider: "minio" as const,
      bucket: "sara-kitchen-media",
      objectKey: "originals/food.jpg",
      originalName: "food.jpg",
      mimeType: "image/jpeg",
      kind: "image" as const,
      bytes: 4096,
      checksum,
      processingState: "ready" as const,
      translations: [{ locale: "en" as const, alt: "Persian food" }],
      uploaderId,
    };

    const original = await Media.create({
      ...base,
      variants: [
        {
          key: "variants/food.webp",
          mimeType: "image/webp",
          bytes: 2048,
          checksum,
          processingState: "ready",
        },
      ],
    });
    expect(original.variants).toHaveLength(1);
    await expect(Media.create(base)).rejects.toMatchObject({ code: 11000 });

    const failed = await Media.create({
      ...base,
      objectKey: "originals/failed.jpg",
      checksum: null,
      processingState: "failed",
      failureCode: "processing_error",
    });
    expect(failed.failureCode).toBe("processing_error");

    const external = await Media.create({
      ...base,
      source: "external",
      provider: "external",
      objectKey: null,
      bucket: null,
      externalUrl: "https://example.com/meal.jpg",
      bytes: null,
      checksum: null,
    });
    expect(external.externalUrl).toBe("https://example.com/meal.jpg");

    original.deletedAt = new Date();
    original.deletedBy = createActorMetadata("admin", uploaderId);
    await original.save();
    expect(await Media.countDocuments({ deletedAt: null })).toBe(2);
    await expect(Media.create(base)).resolves.toBeDefined();
    expect(await Media.countDocuments({ deletedAt: null })).toBe(3);
  });
});
