import { createConnection, Types } from "mongoose";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createActorMetadata } from "@/server/database/schema";
import { getMediaModel, mediaSchema } from "@/server/modules/media/model/media";

const model = getMediaModel(createConnection());
const uploaderId = new Types.ObjectId();
const digest = "a".repeat(64);

function managedImage(overrides: Record<string, unknown> = {}) {
  return new model({
    source: "managed",
    provider: "minio",
    bucket: "sara-kitchen-media",
    objectKey: "originals/meal-1.jpg",
    originalName: "Meal 1.jpg",
    mimeType: "image/jpeg",
    kind: "image",
    bytes: 2048,
    dimensions: { width: 1000, height: 800 },
    checksum: digest,
    processingState: "ready",
    translations: [{ locale: "en", alt: "Persian meal on a plate" }],
    uploaderId,
    ...overrides,
  });
}

describe("Media schema", () => {
  it("represents a ready original with independently tracked derived variants", async () => {
    const document = managedImage({
      variants: [
        {
          key: "variants/meal-1.webp",
          mimeType: "image/webp",
          bytes: 1024,
          dimensions: { width: 500, height: 400 },
          checksum: digest,
          processingState: "ready",
        },
      ],
    });
    await expect(document.validate()).resolves.toBeUndefined();
    expect(document.source).toBe("managed");
    expect(document.variants).toHaveLength(1);
    expect(document.variants[0]?.key).not.toBe(document.objectKey);
    expect(document.usageCount).toBe(0);
    expect(document.deletedAt).toBeNull();
    expect(document.toJSON()).toMatchObject({ id: document._id.toHexString(), schemaVersion: 1 });
    expect(document.get("normalizedSearchText")).toContain("persian meal on a plate");
  });

  it("accepts external assets without claiming a MinIO object", async () => {
    const document = managedImage({
      source: "external",
      provider: "external",
      bucket: null,
      objectKey: null,
      externalUrl: "https://example.com/media/meal.jpg",
      bytes: null,
      checksum: null,
      dimensions: null,
    });
    await expect(document.validate()).resolves.toBeUndefined();
    expect(document.externalUrl).toContain("example.com");
  });

  it("accepts bounded processing failure metadata without raw provider errors", async () => {
    const document = managedImage({
      processingState: "failed",
      failureCode: "processing_error",
      checksum: null,
    });
    await expect(document.validate()).resolves.toBeUndefined();
    document.failureCode = null;
    await expect(document.validate()).rejects.toThrow(/failureCode/u);
  });

  it("accepts failed derived variants without treating the original as failed", async () => {
    const document = managedImage({
      variants: [
        {
          key: "variants/meal-1.webp",
          mimeType: "image/webp",
          bytes: 512,
          processingState: "failed",
          failureCode: "processing_error",
        },
      ],
    });
    await expect(document.validate()).resolves.toBeUndefined();
    expect(document.processingState).toBe("ready");
    expect(document.variants[0]?.processingState).toBe("failed");
  });

  it("stores video duration and PDF page count only for their matching kinds", async () => {
    const video = managedImage({
      kind: "video",
      mimeType: "video/mp4",
      dimensions: null,
      durationMs: 12_000,
    });
    const pdf = managedImage({
      kind: "pdf",
      mimeType: "application/pdf",
      dimensions: null,
      pageCount: 3,
    });
    await expect(video.validate()).resolves.toBeUndefined();
    await expect(pdf.validate()).resolves.toBeUndefined();
    video.pageCount = 3;
    await expect(video.validate()).rejects.toThrow(/pageCount/u);
  });

  it("requires active/deleted provenance and separates deletion from processing state", async () => {
    const document = managedImage({
      deletedAt: new Date(),
      deletedBy: createActorMetadata("admin", uploaderId),
    });
    await expect(document.validate()).resolves.toBeUndefined();
    expect(document.processingState).toBe("ready");
    document.deletedBy = null;
    await expect(document.validate()).rejects.toThrow(/deletedBy/u);
  });

  it.each([
    [{ bucket: null }, /bucket/u],
    [{ objectKey: "../private" }, /objectKey/u],
    [{ checksum: null }, /checksum/u],
    [{ usageCount: -1 }, /usageCount/u],
    [{ translations: [{ locale: "pt-PT", alt: "Comida" }] }, /translations/u],
    [
      {
        variants: [
          {
            key: "originals/meal-1.jpg",
            mimeType: "image/webp",
            bytes: 1,
            checksum: digest,
            processingState: "ready",
          },
        ],
      },
      /variants/u,
    ],
    [
      {
        source: "external",
        provider: "external",
        externalUrl: "http://example.com/a.jpg",
        bucket: null,
        objectKey: null,
      },
      /externalUrl/u,
    ],
    [
      {
        source: "external",
        provider: "external",
        externalUrl: "https://example.com/a.jpg?token=private",
        bucket: null,
        objectKey: null,
      },
      /externalUrl/u,
    ],
  ])("rejects invalid storage, translation, or lifecycle state", async (overrides, message) => {
    await expect(managedImage(overrides).validate()).rejects.toThrow(message);
  });

  it("declares active-key uniqueness and useful queue/list indexes", () => {
    const indexNames = mediaSchema.indexes().map(([, options]) => options.name);
    expect(indexNames).toEqual(
      expect.arrayContaining([
        "media_managed_object_unique",
        "media_processing_queue",
        "media_checksum_active",
        "media_ready_checksum_unique",
        "media_list_recent",
        "media_list_state_kind_recent",
        "media_list_mime_recent",
        "media_list_uploader_recent",
        "media_list_usage_recent",
        "media_text_search",
      ]),
    );
    const managedIndex = mediaSchema
      .indexes()
      .find(([, options]) => options.name === "media_managed_object_unique");
    expect(managedIndex?.[1]).toMatchObject({
      unique: true,
      partialFilterExpression: { source: "managed", deletedAt: null },
    });
    const checksumIndex = mediaSchema
      .indexes()
      .find(([, options]) => options.name === "media_ready_checksum_unique");
    expect(checksumIndex?.[1]).toMatchObject({
      unique: true,
      partialFilterExpression: { source: "managed", processingState: "ready", deletedAt: null },
    });
  });
});
