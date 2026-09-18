import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { MEDIA_READ_URL_TTL_SECONDS, getMediaDetail, listMedia } from "@/server/modules/media";
import type {
  MediaListQueryPlan,
  MediaReadRecord,
  MediaReadRepository,
  StorageProvider,
} from "@/server/modules/media";

const now = new Date("2026-09-18T12:00:00.000Z");
const record: MediaReadRecord = {
  id: "507f1f77bcf86cd799439011",
  source: "managed",
  bucket: "private-media",
  objectKey: "originals/meal.png",
  externalUrl: null,
  originalName: "meal.png",
  mimeType: "image/png",
  kind: "image",
  bytes: 2_000,
  dimensions: { width: 200, height: 100 },
  durationMs: null,
  pageCount: null,
  processingState: "ready",
  failureCode: null,
  variants: [
    {
      key: "variants/display.webp",
      mimeType: "image/webp",
      bytes: 1_000,
      dimensions: { width: 200, height: 100 },
      checksum: "a".repeat(64),
      processingState: "ready",
      failureCode: null,
    },
    {
      key: "variants/thumb.webp",
      mimeType: "image/webp",
      bytes: 200,
      dimensions: { width: 80, height: 40 },
      checksum: "b".repeat(64),
      processingState: "ready",
      failureCode: null,
    },
  ],
  translations: [{ locale: "en", alt: "Meal" }],
  uploaderId: "507f191e810c19729de860ea",
  usageCount: 2,
  createdAt: now,
  updatedAt: now,
};

const plan: MediaListQueryPlan = {
  filter: { deletedAt: null },
  page: 1,
  pageSize: 20,
  skip: 0,
  limit: 20,
  sort: { createdAt: -1, _id: -1 },
  sortBy: "createdAt",
  sortDirection: "desc",
};

function harness(item: MediaReadRecord | null = record) {
  const repository: MediaReadRepository = {
    list: async () => ({ items: item ? [item] : [], total: item ? 1 : 0 }),
    findById: async () => item,
  };
  const signedReadUrl = vi.fn(async (ref: { key: string }, seconds: number) => ({
    url: `https://objects.example/${ref.key}?signature=short-lived`,
    expiresAt: new Date(now.getTime() + seconds * 1_000),
  }));
  const storage = { signedReadUrl } as unknown as StorageProvider;
  return { repository, storage, signedReadUrl };
}

describe("media reads", () => {
  it("lists safe metadata with the smallest ready preview and page metadata", async () => {
    const test = harness();
    const result = await listMedia(test.repository, test.storage, plan);
    expect(result.data[0]).toMatchObject({
      id: record.id,
      originalName: "meal.png",
      preview: {
        url: expect.stringContaining("variants/thumb.webp"),
        expiresAt: "2026-09-18T12:05:00.000Z",
      },
    });
    expect(result.data[0]).not.toHaveProperty("bucket");
    expect(result.data[0]).not.toHaveProperty("objectKey");
    expect(result.meta.pagination).toMatchObject({ totalItems: 1, totalPages: 1 });
    expect(test.signedReadUrl).toHaveBeenCalledWith(
      { bucket: "private-media", key: "variants/thumb.webp" },
      MEDIA_READ_URL_TTL_SECONDS,
    );
  });

  it("returns detail with expiring original and variant URLs", async () => {
    const test = harness();
    const detail = await getMediaDetail(test.repository, test.storage, record.id);
    expect(detail?.original).toEqual({
      url: expect.stringContaining("originals/meal.png"),
      expiresAt: "2026-09-18T12:05:00.000Z",
    });
    expect(detail?.variants).toHaveLength(2);
    expect(detail).not.toHaveProperty("bucket");
    expect(detail).not.toHaveProperty("objectKey");
  });

  it("does not sign external URLs and returns null for missing detail", async () => {
    const external = {
      ...record,
      source: "external" as const,
      bucket: null,
      objectKey: null,
      externalUrl: "https://cdn.example/meal.png",
      variants: [],
    };
    const test = harness(external);
    const result = await listMedia(test.repository, test.storage, plan);
    expect(result.data[0]?.preview).toEqual({
      url: "https://cdn.example/meal.png",
      expiresAt: null,
    });
    expect(test.signedReadUrl).not.toHaveBeenCalled();
    expect(await getMediaDetail(harness(null).repository, test.storage, record.id)).toBeNull();
  });
});
