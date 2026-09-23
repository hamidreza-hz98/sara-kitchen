import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  DishCatalogQueryError,
  createDishCatalogService,
} from "@/server/modules/dishes/service/catalog-query";
import type {
  DishCatalogQueryPlan,
  DishCatalogRecord,
  DishCatalogRepository,
} from "@/server/modules/dishes/repository/catalog";
import type { IngredientAllergenCatalog } from "@/server/modules/ingredients";

const now = new Date("2026-09-23T12:00:00.000Z");

function record(overrides: Partial<DishCatalogRecord> = {}): DishCatalogRecord {
  return {
    id: "1".repeat(24),
    translations: [
      {
        locale: "en",
        name: "Fesenjan",
        excerpt: "Walnut and pomegranate stew",
        description: null,
        specifications: [],
      },
      {
        locale: "fa",
        name: "فسنجان",
        excerpt: "خورش گردو و انار",
        description: null,
        specifications: [],
      },
    ],
    slug: "fesenjan",
    mediaIds: ["2".repeat(24)],
    categoryIds: ["3".repeat(24)],
    ingredientIds: ["4".repeat(24)],
    basePriceCents: 1_200,
    discount: {
      type: "fixed",
      amountCents: 200,
      basisPoints: null,
      startsAt: new Date("2026-09-23T00:00:00.000Z"),
      endsAt: new Date("2026-09-24T00:00:00.000Z"),
    },
    portionAmount: 1,
    portionUnit: "serving",
    availability: {
      mode: "scheduled",
      availableFrom: new Date("2026-09-23T10:00:00.000Z"),
      availableUntil: new Date("2026-09-23T18:00:00.000Z"),
    },
    leadTimeMinutes: 240,
    maxQuantityPerOrder: 10,
    mayContainAllergenTags: ["milk"],
    dietaryTags: ["halal"],
    isFeatured: true,
    featuredOrder: 1,
    ...overrides,
  };
}

function harness(items: readonly DishCatalogRecord[] = [record()], total = items.length) {
  let capturedPlan: DishCatalogQueryPlan | undefined;
  const repository: DishCatalogRepository = {
    list: vi.fn(async (plan) => {
      capturedPlan = plan;
      return { items, total };
    }),
  };
  const ingredients: IngredientAllergenCatalog = {
    findIngredientIdsContainingAny: vi.fn(async () => ["9".repeat(24)]),
    getAllergensByIngredientIds: vi.fn(async () => ({
      ["4".repeat(24)]: ["tree_nuts" as const],
    })),
  };
  return {
    service: createDishCatalogService({ repository, ingredients, now: () => now }),
    ingredients,
    plan: () => capturedPlan,
  };
}

describe("public Dish catalog query service", () => {
  it("returns a localized public projection with pricing, availability, allergens, and metadata", async () => {
    const test = harness();
    const result = await test.service.list({ locale: "fa", viewMode: "list" });

    expect(result.items[0]).toEqual({
      id: "1".repeat(24),
      slug: "fesenjan",
      name: {
        value: "فسنجان",
        resolvedLocale: "fa",
        isFallback: false,
        direction: "rtl",
      },
      excerpt: {
        value: "خورش گردو و انار",
        resolvedLocale: "fa",
        isFallback: false,
        direction: "rtl",
      },
      mediaIds: ["2".repeat(24)],
      categoryIds: ["3".repeat(24)],
      price: expect.objectContaining({
        currency: "EUR",
        effectivePriceCents: 1_000,
        discountCents: 200,
      }),
      portion: { amount: 1, unit: "serving" },
      availability: {
        mode: "scheduled",
        isOrderable: true,
        nextChangeAt: "2026-09-23T18:00:00.000Z",
      },
      leadTimeMinutes: 240,
      maxQuantityPerOrder: 10,
      dietaryTags: ["halal"],
      allergens: { contains: ["tree_nuts"], mayContain: ["milk"] },
      isFeatured: true,
    });
    expect(result.meta).toMatchObject({
      locale: "fa",
      viewMode: "list",
      evaluatedAt: now.toISOString(),
      pagination: { page: 1, pageSize: 12, totalItems: 1, totalPages: 1 },
      sort: { by: "recommended", direction: "asc" },
    });
    expect(result.items[0]).not.toHaveProperty("translations");
    expect(result.items[0]).not.toHaveProperty("ingredientIds");
    expect(result.items[0]).not.toHaveProperty("status");
  });

  it("builds bounded combined search, category, availability, featured, discount, diet, and allergen filters", async () => {
    const test = harness([], 0);
    await test.service.list({
      locale: "pt-PT",
      search: "  Fesênjan  ",
      categoryId: "3".repeat(24),
      availability: "available",
      featured: true,
      discounted: true,
      dietaryTags: ["halal", "vegetarian"],
      excludeAllergens: ["milk", "tree_nuts"],
      sort: "price_asc",
      page: 2,
      pageSize: 6,
    });

    expect(test.ingredients.findIngredientIdsContainingAny).toHaveBeenCalledWith([
      "milk",
      "tree_nuts",
    ]);
    expect(test.plan()).toMatchObject({
      filter: {
        deletedAt: null,
        status: "published",
        $text: { $search: "fesenjan" },
        categoryIds: "3".repeat(24),
        isFeatured: true,
        dietaryTags: { $all: ["halal", "vegetarian"] },
        mayContainAllergenTags: { $nin: ["milk", "tree_nuts"] },
        "ingredients.ingredientId": { $nin: ["9".repeat(24)] },
      },
      sort: { basePriceCents: 1, _id: 1 },
      skip: 6,
      limit: 6,
    });
    expect(test.plan()?.filter.$and).toHaveLength(2);
  });

  it("supports unavailable and non-discounted complements at exact schedule boundaries", async () => {
    const test = harness([], 0);
    await test.service.list({ availability: "unavailable", discounted: false });
    const conditions = test.plan()?.filter.$and as unknown[];
    expect(conditions).toHaveLength(2);
    expect(JSON.stringify(conditions)).toContain("$nor");
    expect(JSON.stringify(conditions)).toContain("$lte");
  });

  it("returns stable page metadata and deterministic sort tie-breakers", async () => {
    const test = harness([record()], 25);
    const result = await test.service.list({ sort: "popular", page: 2, pageSize: 10 });
    expect(test.plan()?.sort).toEqual({ viewCount: -1, _id: 1 });
    expect(result.meta.pagination).toEqual({
      page: 2,
      pageSize: 10,
      totalItems: 25,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    });
  });

  it.each([
    { page: 0 },
    { page: 1_000, pageSize: 60 },
    { search: "x" },
    { categoryId: "invalid" },
    { dietaryTags: ["halal", "halal"] },
    { excludeAllergens: ["milk", "milk"] },
    { sort: "unknown" },
    { locale: "de" },
  ])("rejects malformed or expensive query %#", async (query) => {
    const test = harness();
    await expect(test.service.list(query as never)).rejects.toBeInstanceOf(DishCatalogQueryError);
  });

  it("falls back field-by-field without leaking every translation", async () => {
    const test = harness([
      record({
        translations: [
          {
            locale: "en",
            name: "Fesenjan",
            excerpt: "English excerpt",
            description: null,
            specifications: [],
          },
          {
            locale: "pt-PT",
            name: "Fesenjan português",
            excerpt: "",
            description: null,
            specifications: [],
          },
        ],
      }),
    ]);
    const result = await test.service.list({ locale: "pt-PT" });
    expect(result.items[0]?.name).toMatchObject({
      value: "Fesenjan português",
      resolvedLocale: "pt-PT",
    });
    expect(result.items[0]?.excerpt).toMatchObject({
      value: "English excerpt",
      resolvedLocale: "en",
      isFallback: true,
    });
  });
});
