import { Mongoose, Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getCategoryModel } from "@/server/modules/categories/model/category";
import { createCategoryRepository } from "@/server/modules/categories/repository/category";
import { validateCategoryMediaReferences } from "@/server/modules/categories/validation/category-media";
import { getMediaModel } from "@/server/modules/media/model/media";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

describe("Category persistence", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-category-model-test");
    client = new Mongoose();
    await client.connect(database.uri);
  }, 120_000);

  afterAll(async () => {
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  it("enforces unique slugs under concurrent writes", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const Category = getCategoryModel(client.connection);
    await Category.init();
    const input = {
      translations: [{ locale: "en", name: "Persian stews", description: "Slow-cooked stews" }],
    };
    const results = await Promise.allSettled([
      new Category(input).save(),
      new Category(input).save(),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected).toMatchObject({ reason: { code: 11000 } });
    expect(await Category.countDocuments({ slug: "persian-stews" })).toBe(1);
  });

  it("accepts ready image references and rejects video, pending, deleted, or missing media", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const Media = getMediaModel(client.connection);
    const uploaderId = new Types.ObjectId();
    const external = (name: string, kind: "image" | "video") => ({
      source: "external" as const,
      provider: "external" as const,
      externalUrl: `https://example.com/${name}`,
      originalName: name,
      mimeType: kind === "image" ? "image/jpeg" : "video/mp4",
      kind,
      processingState: "ready" as const,
      translations: [{ locale: "en" as const, alt: name }],
      uploaderId,
    });
    const [image, video, deleted] = await Promise.all([
      new Media(external("banner.jpg", "image")).save(),
      new Media(external("intro.mp4", "video")).save(),
      new Media(external("deleted.jpg", "image")).save(),
    ]);
    deleted.deletedAt = new Date();
    deleted.deletedBy = { kind: "admin", actorId: uploaderId };
    await deleted.save();
    const pending = await new Media({
      source: "managed",
      provider: "minio",
      bucket: "sara-kitchen-media",
      objectKey: "pending/category.jpg",
      originalName: "pending.jpg",
      mimeType: "image/jpeg",
      kind: "image",
      bytes: 1024,
      processingState: "pending",
      translations: [{ locale: "en", alt: "Pending image" }],
      uploaderId,
    }).save();

    await expect(
      validateCategoryMediaReferences(client.connection, {
        bannerMediaId: image._id,
        imageMediaId: image._id,
      }),
    ).resolves.toBeUndefined();
    for (const invalid of [video, pending, deleted]) {
      await expect(
        validateCategoryMediaReferences(client.connection, {
          bannerMediaId: invalid._id,
          imageMediaId: null,
        }),
      ).rejects.toMatchObject({ field: "bannerMediaId" });
    }
    await expect(
      validateCategoryMediaReferences(client.connection, {
        bannerMediaId: null,
        imageMediaId: new Types.ObjectId(),
      }),
    ).rejects.toMatchObject({ field: "imageMediaId" });
  });

  it("persists CRUD snapshots, optimistic updates, archive, soft delete, and restore", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const repository = createCategoryRepository(client.connection);
    const actorId = new Types.ObjectId().toHexString();
    const write = {
      translations: [{ locale: "en" as const, name: "Side dishes", description: "Sides" }],
      slug: "side-dishes",
      bannerMediaId: null,
      imageMediaId: null,
      status: "draft" as const,
      sortOrder: 3,
    };
    const created = await repository.create(write, actorId);
    expect(await repository.findBySlug("side-dishes")).toMatchObject({ id: created.id });
    expect((await repository.list({ page: 1, pageSize: 12 })).items).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: created.id })]),
    );
    const updated = await repository.save(
      created,
      { ...write, status: "archived", sortOrder: 4 },
      actorId,
    );
    await expect(repository.save(created, write, actorId)).rejects.toThrow("category_conflict");
    const deleted = await repository.softDelete(updated, actorId, new Date());
    expect(await repository.findById(created.id)).toBeNull();
    expect(await repository.isSlugTaken("side-dishes")).toBe(true);
    const restored = await repository.restore(deleted, actorId);
    expect(restored.deletedAt).toBeNull();
    expect(restored.status).toBe("archived");
  });
});
