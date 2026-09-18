import { createHash } from "node:crypto";

import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { MediaUploadError, createMediaUpload } from "@/server/modules/media";
import type {
  MediaUploadRecord,
  MediaUploadRepository,
  StorageProvider,
} from "@/server/modules/media";

const actorId = "507f1f77bcf86cd799439011";
const bucket = "private-media";

async function candidate() {
  const data = await sharp({
    create: { width: 200, height: 100, channels: 3, background: "#e66975" },
  })
    .png()
    .toBuffer();
  return { name: "meal.png", blob: new Blob([Uint8Array.from(data)], { type: "image/png" }) };
}

function harness(
  options: { failUploadAt?: number; failCreate?: boolean; duplicate?: boolean } = {},
) {
  const objects = new Map<string, Buffer>();
  const records: MediaUploadRecord[] = [];
  let uploads = 0;
  const storage = {
    async upload(input: Parameters<StorageProvider["upload"]>[0]) {
      uploads += 1;
      const reader = input.body.getReader();
      const chunks: Uint8Array[] = [];
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const data = Buffer.concat(chunks);
      objects.set(input.key, data);
      if (uploads === options.failUploadAt) throw new Error("injected storage failure after write");
      return { ...input, bytes: data.length, etag: null, lastModified: new Date() };
    },
    async delete(ref: { key: string }) {
      objects.delete(ref.key);
    },
  } as unknown as StorageProvider;
  const repository: MediaUploadRepository = {
    findActiveByChecksum: async () => (options.duplicate ? "existing-media" : null),
    quotaUsage: async () => ({ adminRollingDayBytes: 0, activeStorageBytes: 0 }),
    async create(record) {
      if (options.failCreate) throw new Error("injected database failure");
      records.push(record);
      return { id: "new-media" };
    },
  };
  return { objects, records, storage, repository };
}

function input(file: Awaited<ReturnType<typeof candidate>>) {
  return {
    actorId,
    bucket,
    candidate: file,
    translations: [{ locale: "en" as const, alt: "Persian meal" }],
  };
}

describe("media create/upload orchestration", () => {
  it("stores an original and four variants before publishing one ready record", async () => {
    const test = harness();
    const file = await candidate();
    const result = await createMediaUpload(test, input(file));
    expect(result).toMatchObject({ id: "new-media", variantCount: 4 });
    expect(result.checksum).toBe(
      createHash("sha256")
        .update(Buffer.from(await file.blob.arrayBuffer()))
        .digest("hex"),
    );
    expect(test.objects.size).toBe(5);
    expect(test.records).toHaveLength(1);
    expect(test.records[0]?.variants).toHaveLength(4);
    expect(test.records[0]?.objectKey).toMatch(/^originals\//u);
    for (const variant of test.records[0]?.variants ?? []) {
      expect(test.objects.get(variant.key)?.length).toBe(variant.bytes);
    }
  });

  it("rejects a duplicate before any object is written", async () => {
    const test = harness({ duplicate: true });
    await expect(createMediaUpload(test, input(await candidate()))).rejects.toMatchObject({
      code: "duplicate",
    });
    expect(test.objects.size).toBe(0);
    expect(test.records).toHaveLength(0);
  });

  it("removes all attempted keys after a storage failure, including a write-then-error", async () => {
    const test = harness({ failUploadAt: 3 });
    await expect(createMediaUpload(test, input(await candidate()))).rejects.toThrow(
      "injected storage failure",
    );
    expect(test.objects.size).toBe(0);
    expect(test.records).toHaveLength(0);
  });

  it("removes all five objects when the database write fails", async () => {
    const test = harness({ failCreate: true });
    await expect(createMediaUpload(test, input(await candidate()))).rejects.toThrow(
      "injected database failure",
    );
    expect(test.objects.size).toBe(0);
    expect(test.records).toHaveLength(0);
  });

  it("rejects noncanonical alt text before processing", async () => {
    const test = harness();
    await expect(
      createMediaUpload(test, {
        ...input(await candidate()),
        translations: [{ locale: "fa", alt: "غذا" }],
      }),
    ).rejects.toBeInstanceOf(MediaUploadError);
    expect(test.objects.size).toBe(0);
  });
});
