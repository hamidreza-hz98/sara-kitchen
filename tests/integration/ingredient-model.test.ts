import { Mongoose, Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getIngredientModel } from "@/server/modules/ingredients/model/ingredient";
import { validateIngredientImageReference } from "@/server/modules/ingredients/validation/ingredient-media";
import { getMediaModel } from "@/server/modules/media/model/media";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

describe("Ingredient persistence", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-ingredient-model-test");
    client = new Mongoose();
    await client.connect(database.uri);
  }, 120_000);

  afterAll(async () => {
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  it("enforces normalized canonical-name uniqueness and writes timestamps", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const Ingredient = getIngredientModel(client.connection);
    await Ingredient.init();
    const first = await new Ingredient({
      translations: [{ locale: "en", name: "Crème" }],
    }).save();
    expect(first.createdAt).toBeInstanceOf(Date);
    expect(first.updatedAt).toBeInstanceOf(Date);
    await expect(
      new Ingredient({ translations: [{ locale: "en", name: "Creme" }] }).save(),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it("allows a duplicate canonical name only after the active record is soft-deleted", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const Ingredient = getIngredientModel(client.connection);
    const existing = await Ingredient.findOne({ canonicalNameKey: "creme" }).select(
      "+canonicalNameKey",
    );
    if (!existing) throw new Error("Expected seeded ingredient.");
    const actorId = new Types.ObjectId();
    existing.deletedAt = new Date();
    existing.deletedBy = { kind: "admin", actorId };
    await existing.save();
    await expect(
      new Ingredient({ translations: [{ locale: "en", name: "Crème" }] }).save(),
    ).resolves.toMatchObject({ canonicalNameKey: "creme" });
  });

  it("accepts ready images and rejects wrong-kind, pending, deleted, and missing media", async () => {
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
      new Media(external("saffron.jpg", "image")).save(),
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
      objectKey: "pending/ingredient.jpg",
      originalName: "pending.jpg",
      mimeType: "image/jpeg",
      kind: "image",
      bytes: 1024,
      processingState: "pending",
      translations: [{ locale: "en", alt: "Pending ingredient" }],
      uploaderId,
    }).save();

    await expect(
      validateIngredientImageReference(client.connection, null),
    ).resolves.toBeUndefined();
    await expect(
      validateIngredientImageReference(client.connection, image._id),
    ).resolves.toBeUndefined();
    for (const invalid of [video._id, pending._id, deleted._id, new Types.ObjectId()]) {
      await expect(validateIngredientImageReference(client.connection, invalid)).rejects.toThrow(
        "ready image",
      );
    }
  });
});
