import { Mongoose, Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { countDishesUsingIngredient } from "@/server/modules/dishes";
import { createIngredientRepository, createIngredientServices } from "@/server/modules/ingredients";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

describe("ingredient reference-safe deletion", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-ingredient-reference-test");
    client = new Mongoose();
    await client.connect(database.uri);
  }, 120_000);

  afterAll(async () => {
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  it("cannot soft-delete an archived ingredient used by a dish", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const actorId = new Types.ObjectId().toHexString();
    const repository = createIngredientRepository(client.connection);
    const created = await repository.create(
      {
        translations: [{ locale: "en", name: "Barberry" }],
        imageMediaId: null,
        allergenTags: [],
        status: "archived",
      },
      actorId,
    );
    await client.connection.collection("dishes").insertOne({
      name: "Barberry rice",
      ingredients: [{ ingredientId: new Types.ObjectId(created.id) }],
      deletedAt: null,
    });
    const service = createIngredientServices({
      repository,
      validateImage: async () => undefined,
      countDishReferences: (id) => countDishesUsingIngredient(client!.connection, id),
      audit: async () => undefined,
      invalidate: () => undefined,
    });
    await expect(service.delete({ id: actorId, role: "owner" }, created.id)).rejects.toMatchObject({
      code: "referenced",
    });
    expect(await repository.findById(created.id)).toMatchObject({ deletedAt: null });
  });
});
