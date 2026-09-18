import { Mongoose, Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import englishMessages from "@/locales/messages/en/validation.json";
import { getMediaModel } from "@/server/modules/media/model/media";
import { createMediaReadRepository } from "@/server/modules/media/repository/media-read";
import { parseMediaListQuery } from "@/server/modules/media/validation/media-read-query";
import type { ValidationMessageTranslator } from "@/validations/request";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

const translate: ValidationMessageTranslator = (key) => englishMessages[key];
const uploaderA = new Types.ObjectId();
const uploaderB = new Types.ObjectId();

describe("media list persistence and indexes", () => {
  let database: TestMongoDatabase;
  let client: Mongoose;

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-media-read-test");
    client = new Mongoose();
    await client.connect(database.uri);
    const Media = getMediaModel(client.connection);
    await Media.init();
    await Media.create([
      {
        source: "managed",
        provider: "minio",
        bucket: "private-media",
        objectKey: "originals/saffron-rice.png",
        originalName: "Saffron rice.png",
        mimeType: "image/png",
        kind: "image",
        bytes: 2_000,
        dimensions: { width: 200, height: 100 },
        checksum: "a".repeat(64),
        processingState: "ready",
        translations: [
          { locale: "en", alt: "Persian saffron rice" },
          { locale: "fa", alt: "برنج زعفرانی" },
        ],
        uploaderId: uploaderA,
        usageCount: 3,
      },
      {
        source: "managed",
        provider: "minio",
        bucket: "private-media",
        objectKey: "originals/stew.webp",
        originalName: "Stew.webp",
        mimeType: "image/webp",
        kind: "image",
        bytes: 1_500,
        dimensions: { width: 160, height: 100 },
        checksum: "b".repeat(64),
        processingState: "ready",
        translations: [{ locale: "en", alt: "Herb stew" }],
        uploaderId: uploaderB,
        usageCount: 0,
      },
      {
        source: "managed",
        provider: "minio",
        bucket: "private-media",
        objectKey: "originals/failed.pdf",
        originalName: "Failed menu.pdf",
        mimeType: "application/pdf",
        kind: "pdf",
        bytes: 4_000,
        checksum: null,
        processingState: "failed",
        failureCode: "processing_error",
        translations: [{ locale: "en", alt: "Failed menu" }],
        uploaderId: uploaderA,
        usageCount: 0,
      },
    ]);
  }, 120_000);

  afterAll(async () => {
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  it("applies combined search, type, uploader, usage, state, date, and pagination filters", async () => {
    const plan = parseMediaListQuery(
      new URLSearchParams(
        `search=persian&kind=image&mimeType=image%2Fpng&uploaderId=${uploaderA.toHexString()}` +
          "&usage=used&processingState=ready&createdFrom=2020-01-01&pageSize=1",
      ),
      { translate },
    );
    const result = await createMediaReadRepository(client.connection).list(plan);
    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      originalName: "Saffron rice.png",
      usageCount: 3,
      uploaderId: uploaderA.toHexString(),
    });
  });

  it("uses the compound state/kind index for the realistic recent-media query", async () => {
    const Media = getMediaModel(client.connection);
    const explanation = await Media.find({
      deletedAt: null,
      processingState: "ready",
      kind: "image",
    })
      .sort({ createdAt: -1, _id: -1 })
      .explain("queryPlanner");
    expect(JSON.stringify(explanation)).toContain("media_list_state_kind_recent");
    expect(JSON.stringify(explanation)).toContain("IXSCAN");
  });
});
