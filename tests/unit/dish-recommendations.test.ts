import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { IngredientAllergenCatalog } from "@/server/modules/ingredients";
import type { DishCatalogRecord } from "@/server/modules/dishes/repository/catalog";
import type {
  DishRecommendationCandidatePools,
  DishRecommendationRepository,
  DishRecommendationSource,
} from "@/server/modules/dishes/repository/recommendations";
import {
  DishRecommendationError,
  createDishRecommendationService,
} from "@/server/modules/dishes/service/recommendations";

const NOW = new Date("2026-10-13T12:00:00.000Z");
const CART_A = "1".repeat(24);
const CART_B = "2".repeat(24);
const RELATED = "3".repeat(24);
const CATEGORY = "4".repeat(24);
const FEATURED = "5".repeat(24);
const SHARED_CATEGORY = "6".repeat(24);

function record(id: string, overrides: Partial<DishCatalogRecord> = {}): DishCatalogRecord {
  return {
    id,
    translations: [
      {
        locale: "en",
        name: `Dish ${id[0]}`,
        excerpt: "English excerpt",
        description: null,
        specifications: [],
      },
      {
        locale: "fa",
        name: `غذا ${id[0]}`,
        excerpt: "توضیحات",
        description: null,
        specifications: [],
      },
    ],
    slug: `dish-${id[0]}`,
    mediaIds: [],
    categoryIds: [SHARED_CATEGORY],
    ingredientIds: [],
    basePriceCents: 1_000,
    discount: {
      type: "none",
      amountCents: null,
      basisPoints: null,
      startsAt: null,
      endsAt: null,
    },
    portionAmount: 1,
    portionUnit: "serving",
    availability: { mode: "available", availableFrom: null, availableUntil: null },
    leadTimeMinutes: 60,
    maxQuantityPerOrder: 10,
    mayContainAllergenTags: [],
    dietaryTags: ["halal"],
    isFeatured: false,
    featuredOrder: 0,
    ...overrides,
  };
}

function harness(
  sources: readonly DishRecommendationSource[],
  pools: DishRecommendationCandidatePools,
) {
  const repository: DishRecommendationRepository = {
    findSources: vi.fn(async () => sources),
    findCandidates: vi.fn(async () => pools),
  };
  const ingredients: IngredientAllergenCatalog = {
    findIngredientIdsContainingAny: vi.fn(async () => []),
    getAllergensByIngredientIds: vi.fn(async () => ({})),
  };
  return {
    ingredients,
    repository,
    service: createDishRecommendationService({ ingredients, repository, now: () => NOW }),
  };
}

describe("deterministic dish recommendations", () => {
  it("ranks related, category, then featured candidates and explains every choice", async () => {
    const test = harness(
      [
        { id: CART_A, categoryIds: [SHARED_CATEGORY], relatedDishIds: [RELATED] },
        { id: CART_B, categoryIds: [SHARED_CATEGORY], relatedDishIds: [] },
      ],
      {
        related: [record(RELATED)],
        category: [record(CATEGORY), record(RELATED)],
        featured: [record(FEATURED, { isFeatured: true }), record(CATEGORY)],
      },
    );

    const result = await test.service({
      currentDishIds: [CART_A, CART_B],
      locale: "fa",
      limit: 3,
    });

    expect(result.items.map(({ id }) => id)).toEqual([RELATED, CATEGORY, FEATURED]);
    expect(result.items.map(({ reason }) => reason.kind)).toEqual([
      "related",
      "category",
      "featured",
    ]);
    expect(result.items[0]).toMatchObject({
      name: { value: "غذا 3", direction: "rtl", resolvedLocale: "fa" },
      reason: { kind: "related", sourceDishIds: [CART_A] },
    });
    expect(result.items[1]?.reason).toMatchObject({
      kind: "category",
      sharedCategoryIds: [SHARED_CATEGORY],
      sourceDishIds: [CART_A, CART_B],
    });
    expect(test.repository.findCandidates).toHaveBeenCalledWith({
      at: NOW,
      categoryIds: [SHARED_CATEGORY],
      excludeDishIds: [CART_A, CART_B],
      poolSize: 9,
      relatedDishIds: [RELATED],
    });
  });

  it("caps output, deduplicates candidates, and uses stable featured ordering", async () => {
    const featuredLate = record("8".repeat(24), { isFeatured: true, featuredOrder: 8 });
    const featuredEarly = record("7".repeat(24), { isFeatured: true, featuredOrder: 1 });
    const test = harness([{ id: CART_A, categoryIds: [], relatedDishIds: [] }], {
      related: [],
      category: [],
      featured: [featuredLate, featuredEarly, featuredEarly],
    });

    const result = await test.service({ currentDishIds: [CART_A], limit: 1 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe(featuredEarly.id);
  });

  it("falls back field-by-field and skips malformed records without failing the list", async () => {
    const malformed = record("9".repeat(24), { translations: [] });
    const valid = record(FEATURED, {
      translations: [
        {
          locale: "en",
          name: "Featured",
          excerpt: "Fallback excerpt",
          description: null,
          specifications: [],
        },
        {
          locale: "pt-PT",
          name: "Destaque",
          excerpt: "",
          description: null,
          specifications: [],
        },
      ],
    });
    const test = harness([{ id: CART_A, categoryIds: [], relatedDishIds: [] }], {
      related: [],
      category: [],
      featured: [malformed, valid],
    });

    const result = await test.service({ currentDishIds: [CART_A], locale: "pt-PT" });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      name: { value: "Destaque", resolvedLocale: "pt-PT" },
      excerpt: { value: "Fallback excerpt", resolvedLocale: "en", isFallback: true },
    });
  });

  it("does no catalog work for an empty cart and rejects duplicate or invalid input", async () => {
    const test = harness([], { related: [], category: [], featured: [] });
    await expect(test.service({ currentDishIds: [], locale: "en" })).resolves.toEqual({
      evaluatedAt: NOW.toISOString(),
      items: [],
      locale: "en",
    });
    expect(test.repository.findSources).not.toHaveBeenCalled();

    await expect(test.service({ currentDishIds: [CART_A, CART_A] })).rejects.toBeInstanceOf(
      DishRecommendationError,
    );
    await expect(test.service({ currentDishIds: ["bad"] })).rejects.toBeInstanceOf(
      DishRecommendationError,
    );
    await expect(test.service({ currentDishIds: [CART_A], limit: 13 })).rejects.toBeInstanceOf(
      DishRecommendationError,
    );
  });
});
