import { Mongoose, Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getDishModel } from "@/server/modules/dishes/model/dish";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

describe("Dish persistence", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-dish-model-test");
    client = new Mongoose();
    await client.connect(database.uri);
  }, 120_000);

  afterAll(async () => {
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  it("enforces slug uniqueness and persists timestamps, references, and counters", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const Dish = getDishModel(client.connection);
    await Dish.init();
    const ingredientId = new Types.ObjectId();
    const input = {
      translations: [{ locale: "en" as const, name: "Fesenjan" }],
      basePriceCents: 2_200,
      mediaIds: [new Types.ObjectId()],
      categoryIds: [new Types.ObjectId()],
      ingredients: [{ ingredientId }],
      leadTimeMinutes: 240,
      status: "published" as const,
    };
    const created = await new Dish(input).save();
    expect(created.createdAt).toBeInstanceOf(Date);
    expect(created.updatedAt).toBeInstanceOf(Date);
    expect(created.slug).toBe("fesenjan");
    expect(created.soldCount).toBe(0);
    expect(created.viewCount).toBe(0);
    expect(created.ingredients[0]?.ingredientId).toEqual(ingredientId);
    await expect(new Dish(input).save()).rejects.toMatchObject({ code: 11000 });
  });

  it("supports indexed public catalog and category queries", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const Dish = getDishModel(client.connection);
    const categoryId = new Types.ObjectId();
    await new Dish({
      translations: [{ locale: "en", name: "Kashk Bademjan" }],
      basePriceCents: 850,
      categoryIds: [categoryId],
      availability: { mode: "available" },
      status: "published",
      isFeatured: true,
      featuredOrder: 1,
    }).save();

    const publicPlan = await Dish.find({
      deletedAt: null,
      status: "published",
      "availability.mode": "available",
    })
      .sort({ createdAt: -1, _id: 1 })
      .explain("executionStats");
    const categoryPlan = await Dish.find({
      categoryIds: categoryId,
      deletedAt: null,
      status: "published",
    })
      .sort({ createdAt: -1 })
      .explain("executionStats");
    expect(JSON.stringify(publicPlan)).toContain("dish_public_catalog");
    expect(JSON.stringify(categoryPlan)).toContain("dish_category_catalog");
  });
});
