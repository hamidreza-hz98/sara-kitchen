import sharp from "sharp";
import { Mongoose } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getMediaModel } from "@/server/modules/media/model/media";
import { createMediaUploadRepository } from "@/server/modules/media/repository/media-upload";
import type { MediaUploadRecord } from "@/server/modules/media/repository/media-upload";
import { createMediaUpload } from "@/server/modules/media/service/create-upload";
import type { StorageProvider } from "@/server/modules/media/storage/storage-provider";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

describe("media upload persistence and rollback", () => {
  let database: TestMongoDatabase;
  let client: Mongoose;
  const actorId = "507f1f77bcf86cd799439011";
  const bucket = "private-media";

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-media-upload-test");
    client = new Mongoose();
    await client.connect(database.uri);
    await getMediaModel(client.connection).init();
  }, 120_000);

  afterAll(async () => {
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  async function file(name: string) {
    const data = await sharp({
      create: { width: 120, height: 80, channels: 3, background: name === "a" ? "red" : "blue" },
    })
      .png()
      .toBuffer();
    return { name: `${name}.png`, blob: new Blob([Uint8Array.from(data)], { type: "image/png" }) };
  }

  function storage(failAt = 0) {
    const objects = new Map<string, Buffer>();
    let count = 0;
    const provider = {
      async upload(input: Parameters<StorageProvider["upload"]>[0]) {
        count += 1;
        const chunks: Uint8Array[] = [];
        const reader = input.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        const data = Buffer.concat(chunks);
        objects.set(input.key, data);
        if (count === failAt) throw new Error("injected storage failure");
        return { ...input, bytes: data.length, etag: null, lastModified: new Date() };
      },
      async delete(ref: { key: string }) {
        objects.delete(ref.key);
      },
    } as unknown as StorageProvider;
    return { provider, objects };
  }

  it("persists one ready record after all five objects and enforces checksum uniqueness", async () => {
    const Media = getMediaModel(client.connection);
    const repo = createMediaUploadRepository(client.connection);
    const stored = storage();
    let record: MediaUploadRecord | undefined;
    const repository = {
      ...repo,
      async create(value: MediaUploadRecord) {
        record = value;
        return repo.create(value);
      },
    };
    const result = await createMediaUpload(
      { repository, storage: stored.provider },
      {
        actorId,
        bucket,
        candidate: await file("a"),
        translations: [{ locale: "en", alt: "Red meal" }],
      },
    );
    expect(stored.objects.size).toBe(5);
    expect(await Media.countDocuments({ processingState: "ready" })).toBe(1);
    const persisted = await Media.findById(result.id).lean();
    expect(persisted?.checksum).toBe(result.checksum);
    expect(persisted?.variants).toHaveLength(4);
    expect((await repo.quotaUsage(actorId)).activeStorageBytes).toBeGreaterThan(
      persisted?.bytes ?? 0,
    );
    if (!record) throw new Error("Missing captured media record.");
    await expect(
      repo.create({ ...record, objectKey: "originals/duplicate.png" }),
    ).rejects.toMatchObject({ code: 11000 });
    expect(await Media.countDocuments()).toBe(1);
  });

  it("does not persist a record or leave objects after a write-then-error", async () => {
    const Media = getMediaModel(client.connection);
    const stored = storage(3);
    await expect(
      createMediaUpload(
        { repository: createMediaUploadRepository(client.connection), storage: stored.provider },
        {
          actorId,
          bucket,
          candidate: await file("b"),
          translations: [{ locale: "en", alt: "Blue meal" }],
        },
      ),
    ).rejects.toThrow("injected storage failure");
    expect(stored.objects.size).toBe(0);
    expect(await Media.countDocuments()).toBe(1);
  });
});
