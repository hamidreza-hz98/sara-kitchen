import { Mongoose, Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createDishCatalogRepository } from "@/server/modules/dishes/repository/catalog";
import { createDishCatalogService } from "@/server/modules/dishes/service/catalog-query";
import { getDishModel } from "@/server/modules/dishes/model/dish";
import { createIngredientAllergenCatalog, getIngredientModel } from "@/server/modules/ingredients";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

const now = new Date("2026-09-23T12:00:00.000Z");

describe("public Dish catalog queries", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;
  let categoryId: Types.ObjectId;

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-dish-catalog-test");
    client = new Mongoose();
    await client.connect(database.uri);
    const Ingredient = getIngredientModel(client.connection);
    const Dish = getDishModel(client.connection);
    await Promise.all([Ingredient.init(), Dish.init()]);

    const [walnut, herb] = await Ingredient.create([
      {
        translations: [{ locale: "en", name: "Walnut" }],
        allergenTags: ["tree_nuts"],
        status: "published",
      },
      {
        translations: [{ locale: "en", name: "Fresh herbs" }],
        allergenTags: [],
        status: "published",
      },
    ]);
    if (!walnut || !herb) throw new Error("Ingredient fixtures failed.");
    categoryId = new Types.ObjectId();

    await Dish.create([
      {
        translations: [
          { locale: "en", name: "Fesenjan", excerpt: "Walnut stew" },
          { locale: "pt-PT", name: "Fesenjan", excerpt: "Guisado de noz" },
          { locale: "fa", name: "فسنجان", excerpt: "خورش گردو" },
        ],
        slug: "fesenjan-catalog",
        categoryIds: [categoryId],
        mediaIds: [new Types.ObjectId()],
        ingredients: [{ ingredientId: walnut._id }],
        basePriceCents: 1_200,
        discount: {
          type: "fixed",
          amountCents: 200,
          startsAt: new Date("2026-09-23T00:00:00.000Z"),
          endsAt: new Date("2026-09-24T00:00:00.000Z"),
        },
        availability: { mode: "available" },
        dietaryTags: ["halal"],
        isFeatured: true,
        featuredOrder: 1,
        soldCount: 20,
        viewCount: 100,
        status: "published",
      },
      {
        translations: [
          { locale: "en", name: "Ghormeh Sabzi", excerpt: "Herb stew" },
          { locale: "pt-PT", name: "Ghormeh Sabzi", excerpt: "Guisado de ervas" },
          { locale: "fa", name: "قرمه سبزی", excerpt: "خورش سبزی" },
        ],
        slug: "ghormeh-sabzi-catalog",
        categoryIds: [categoryId],
        mediaIds: [new Types.ObjectId()],
        ingredients: [{ ingredientId: herb._id }],
        basePriceCents: 900,
        availability: { mode: "available" },
        dietaryTags: ["halal"],
        soldCount: 10,
        viewCount: 50,
        status: "published",
      },
      {
        translations: [
          { locale: "en", name: "Season Salad", excerpt: "Fresh salad" },
          { locale: "pt-PT", name: "Salada", excerpt: "Salada fresca" },
          { locale: "fa", name: "سالاد فصل", excerpt: "سالاد تازه" },
        ],
        slug: "season-salad-catalog",
        categoryIds: [categoryId],
        mediaIds: [new Types.ObjectId()],
        ingredients: [{ ingredientId: herb._id }],
        basePriceCents: 900,
        availability: {
          mode: "scheduled",
          availableFrom: new Date("2026-09-24T00:00:00.000Z"),
        },
        dietaryTags: ["vegan", "vegetarian", "halal"],
        mayContainAllergenTags: ["milk"],
        status: "published",
      },
      {
        translations: [{ locale: "en", name: "Hidden draft" }],
        slug: "hidden-draft-catalog",
        basePriceCents: 100,
        status: "draft",
      },
    ]);
  }, 120_000);

  afterAll(async () => {
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  function service() {
    if (!client) throw new Error("Test MongoDB did not start.");
    return createDishCatalogService({
      repository: createDishCatalogRepository(client.connection),
      ingredients: createIngredientAllergenCatalog(client.connection),
      now: () => now,
    });
  }

  it("combines public filters and derives allergens without exposing draft records", async () => {
    const result = await service().list({
      locale: "fa",
      categoryId: categoryId.toHexString(),
      availability: "available",
      dietaryTags: ["halal"],
      excludeAllergens: ["tree_nuts", "milk"],
      sort: "price_asc",
    });
    expect(result.items.map((item) => item.slug)).toEqual(["ghormeh-sabzi-catalog"]);
    expect(result.items[0]).toMatchObject({
      name: { value: "قرمه سبزی", direction: "rtl" },
      allergens: { contains: [], mayContain: [] },
      availability: { isOrderable: true },
    });
    expect(result.meta.pagination.totalItems).toBe(1);
  });

  it("returns active discounted dishes and stable non-overlapping pages", async () => {
    const discounted = await service().list({ discounted: true });
    expect(discounted.items.map((item) => item.slug)).toEqual(["fesenjan-catalog"]);
    expect(discounted.items[0]?.price.effectivePriceCents).toBe(1_000);

    const firstPage = await service().list({ sort: "price_asc", page: 1, pageSize: 1 });
    const secondPage = await service().list({ sort: "price_asc", page: 2, pageSize: 1 });
    expect(firstPage.items[0]?.id).not.toBe(secondPage.items[0]?.id);
    expect(firstPage.meta.pagination).toMatchObject({ totalItems: 3, hasNextPage: true });
  });

  it("uses named indexes for launch-critical catalog query shapes", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const Dish = getDishModel(client.connection);
    const plans = await Promise.all([
      Dish.find({ deletedAt: null, status: "published" })
        .sort({ createdAt: -1, _id: 1 })
        .explain("queryPlanner"),
      Dish.find({ deletedAt: null, status: "published", categoryIds: categoryId })
        .sort({ createdAt: -1, _id: 1 })
        .explain("queryPlanner"),
      Dish.find({ deletedAt: null, status: "published", isFeatured: true })
        .sort({ isFeatured: -1, featuredOrder: 1, _id: 1 })
        .explain("queryPlanner"),
      Dish.find({ deletedAt: null, status: "published" })
        .sort({ viewCount: -1, _id: 1 })
        .explain("queryPlanner"),
      Dish.find({ deletedAt: null, status: "published", $text: { $search: "fesenjan" } }).explain(
        "queryPlanner",
      ),
    ]);
    const serialized = plans.map((plan) => JSON.stringify(plan));
    expect(serialized[0]).toContain("dish_public_catalog");
    expect(serialized[1]).toContain("dish_category_catalog");
    expect(serialized[2]).toContain("dish_featured_catalog");
    expect(serialized[3]).toContain("dish_popular_catalog");
    expect(serialized[4]).toContain("dish_text_search");
    for (const plan of serialized) expect(plan).toContain("IXSCAN");
  });
});
