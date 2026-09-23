import { createConnection, Types } from "mongoose";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  DISH_DEFAULT_MAX_QUANTITY_PER_ORDER,
  DISH_MAX_LEAD_TIME_MINUTES,
  dishSchema,
  getDishModel,
} from "@/server/modules/dishes/model/dish";

const Dish = getDishModel(createConnection());

function dish(overrides: Record<string, unknown> = {}) {
  return new Dish({
    translations: [{ locale: "en", name: "Ghormeh Sabzi" }],
    basePriceCents: 1_850,
    ...overrides,
  });
}

describe("Dish schema", () => {
  it("stores the complete translated catalog aggregate and stable defaults", async () => {
    const mediaId = new Types.ObjectId();
    const categoryId = new Types.ObjectId();
    const ingredientId = new Types.ObjectId();
    const relatedDishId = new Types.ObjectId();
    const relatedBlogId = new Types.ObjectId();
    const seoPageId = new Types.ObjectId();
    const document = dish({
      translations: [
        {
          locale: "en",
          name: "Ghormeh Sabzi",
          excerpt: "Persian herb stew",
          description: { type: "doc", content: [{ type: "paragraph" }] },
          specifications: [{ label: "Spice level", value: "Medium" }],
        },
        {
          locale: "pt-PT",
          name: "Ghormeh Sabzi",
          excerpt: "Ensopado persa de ervas",
          specifications: [{ label: "Picante", value: "Médio" }],
        },
        {
          locale: "fa",
          name: "قرمه سبزی",
          excerpt: "خورش سبزی ایرانی",
          specifications: [{ label: "تندی", value: "متوسط" }],
        },
      ],
      mediaIds: [mediaId],
      categoryIds: [categoryId],
      ingredients: [
        {
          ingredientId,
          quantityAmount: 250,
          quantityUnit: "gram",
          notes: [
            { locale: "en", note: "Finely chopped" },
            { locale: "fa", note: "ریز خرد شده" },
          ],
        },
      ],
      discount: {
        type: "percentage",
        basisPoints: 1_500,
        amountCents: null,
        startsAt: new Date("2026-09-01T00:00:00.000Z"),
        endsAt: new Date("2026-10-01T00:00:00.000Z"),
      },
      portionAmount: 1,
      portionUnit: "serving",
      availability: {
        mode: "scheduled",
        availableFrom: new Date("2026-09-01T00:00:00.000Z"),
        availableUntil: null,
      },
      leadTimeMinutes: 180,
      maxQuantityPerOrder: 6,
      mayContainAllergenTags: ["tree_nuts"],
      dietaryTags: ["halal"],
      isFeatured: true,
      featuredOrder: 2,
      relatedDishIds: [relatedDishId],
      relatedBlogIds: [relatedBlogId],
      seoPageId,
      soldCount: 14,
      viewCount: 80,
      status: "published",
    });

    await expect(document.validate()).resolves.toBeUndefined();
    expect(document.slug).toBe("ghormeh-sabzi");
    expect(document.translations).toHaveLength(3);
    expect(document.ingredients[0]?.notes).toHaveLength(2);
    expect(document.toJSON()).toMatchObject({
      id: document._id.toHexString(),
      schemaVersion: 1,
      basePriceCents: 1_850,
      status: "published",
    });
  });

  it("generates the slug once and applies safe commerce defaults", async () => {
    const document = dish();
    await expect(document.validate()).resolves.toBeUndefined();
    expect(document).toMatchObject({
      slug: "ghormeh-sabzi",
      status: "draft",
      basePriceCents: 1_850,
      portionAmount: 1,
      portionUnit: "serving",
      leadTimeMinutes: 0,
      maxQuantityPerOrder: DISH_DEFAULT_MAX_QUANTITY_PER_ORDER,
      isFeatured: false,
      featuredOrder: 0,
      soldCount: 0,
      viewCount: 0,
    });
    expect(document.discount).toMatchObject({ type: "none" });
    expect(document.availability).toMatchObject({ mode: "available" });
    document.translations[0]!.name = "Renamed dish";
    await document.validate();
    expect(document.slug).toBe("ghormeh-sabzi");
  });

  it("canonicalizes vegan as vegetarian", async () => {
    const document = dish({ dietaryTags: ["vegan"] });
    await expect(document.validate()).resolves.toBeUndefined();
    expect(document.dietaryTags).toEqual(["vegan", "vegetarian"]);
  });

  it.each([
    ["none", { type: "none", amountCents: null, basisPoints: null }],
    ["fixed", { type: "fixed", amountCents: 500, basisPoints: null }],
    ["percentage", { type: "percentage", amountCents: null, basisPoints: 2_500 }],
  ])("accepts a valid %s discount model", async (_label, discount) => {
    await expect(dish({ discount }).validate()).resolves.toBeUndefined();
  });

  it.each([
    [{ basePriceCents: -1 }, /basePriceCents/u],
    [{ basePriceCents: 10.5 }, /basePriceCents/u],
    [{ discount: { type: "fixed", amountCents: 2_000 } }, /discount/u],
    [{ discount: { type: "fixed", amountCents: 100, basisPoints: 100 } }, /discount/u],
    [{ discount: { type: "percentage", basisPoints: 0 } }, /discount/u],
    [{ discount: { type: "percentage", basisPoints: 10_001 } }, /discount/u],
    [
      {
        discount: {
          type: "fixed",
          amountCents: 100,
          startsAt: new Date("2026-10-01T00:00:00.000Z"),
          endsAt: new Date("2026-09-01T00:00:00.000Z"),
        },
      },
      /discount/u,
    ],
  ])("rejects invalid price or discount data: %j", async (overrides, expected) => {
    await expect(dish(overrides).validate()).rejects.toThrow(expected);
  });

  it.each([
    [{ portionAmount: 0 }, /portionAmount/u],
    [{ portionAmount: 1.5 }, /portionAmount/u],
    [{ portionUnit: "kilogram" }, /portionUnit/u],
    [{ leadTimeMinutes: -1 }, /leadTimeMinutes/u],
    [{ leadTimeMinutes: DISH_MAX_LEAD_TIME_MINUTES + 1 }, /leadTimeMinutes/u],
    [{ maxQuantityPerOrder: 0 }, /maxQuantityPerOrder/u],
    [{ maxQuantityPerOrder: 100 }, /maxQuantityPerOrder/u],
    [{ featuredOrder: -1 }, /featuredOrder/u],
    [{ soldCount: -1 }, /soldCount/u],
    [{ viewCount: 1.5 }, /viewCount/u],
    [{ status: "hidden" }, /status/u],
    [{ availability: { mode: "scheduled" } }, /availability/u],
    [{ availability: { mode: "available", availableFrom: new Date() } }, /availability/u],
    [
      {
        availability: {
          mode: "scheduled",
          availableFrom: new Date("2026-10-01T00:00:00.000Z"),
          availableUntil: new Date("2026-09-01T00:00:00.000Z"),
        },
      },
      /availability/u,
    ],
  ])(
    "rejects invalid quantity, time, availability, counter, or status data: %j",
    async (overrides, expected) => {
      await expect(dish(overrides).validate()).rejects.toThrow(expected);
    },
  );

  it("rejects invalid translations, references, ingredient metadata, and relationships", async () => {
    const ingredientId = new Types.ObjectId();
    const related = new Types.ObjectId();
    const cases: [Record<string, unknown>, RegExp][] = [
      [{ translations: [] }, /translations/u],
      [{ translations: [{ locale: "fa", name: "غذا" }] }, /translations/u],
      [
        {
          translations: [
            {
              locale: "en",
              name: "Dish",
              specifications: [
                { label: "Heat", value: "Low" },
                { label: " heat ", value: "High" },
              ],
            },
          ],
        },
        /specifications/u,
      ],
      [
        { translations: [{ locale: "en", name: "Dish", description: "not rich text" }] },
        /description/u,
      ],
      [{ slug: "menu" }, /slug/u],
      [{ slug: "Invalid Slug" }, /slug/u],
      [{ mediaIds: [related, related] }, /mediaIds/u],
      [{ categoryIds: ["not-an-id"] }, /categoryIds/u],
      [
        {
          ingredients: [
            { ingredientId, quantityAmount: 20, quantityUnit: "gram" },
            { ingredientId, quantityAmount: 30, quantityUnit: "gram" },
          ],
        },
        /ingredients/u,
      ],
      [{ ingredients: [{ ingredientId, quantityAmount: 20, quantityUnit: null }] }, /ingredients/u],
      [{ ingredients: [{ ingredientId, notes: [{ locale: "fa", note: "ریز" }] }] }, /ingredients/u],
      [{ mayContainAllergenTags: ["milk", "milk"] }, /mayContainAllergenTags/u],
      [{ mayContainAllergenTags: ["unknown"] }, /mayContainAllergenTags/u],
      [{ dietaryTags: ["vegan", "vegan"] }, /dietaryTags/u],
      [{ dietaryTags: ["keto"] }, /dietaryTags/u],
      [{ seoPageId: "not-an-id" }, /seoPageId/u],
    ];

    for (const [overrides, expected] of cases) {
      await expect(dish(overrides).validate()).rejects.toThrow(expected);
    }

    const self = dish();
    self.relatedDishIds = [self._id];
    await expect(self.validate()).rejects.toThrow(/relatedDishIds/u);
  });

  it("declares unique slug, catalog, relationship, schedule, search, and filter indexes", () => {
    const indexes = dishSchema.indexes();
    expect(indexes.find(([fields]) => fields.slug === 1)?.[1]).toMatchObject({ unique: true });
    expect(indexes.map(([, options]) => options.name)).toEqual(
      expect.arrayContaining([
        "dish_public_catalog",
        "dish_category_catalog",
        "dish_featured_catalog",
        "dish_price_catalog",
        "dish_availability_schedule",
        "dish_discount_schedule",
        "dish_text_search",
        "dish_media_refs",
        "dish_ingredient_refs",
        "dish_related_dish_refs",
        "dish_related_blog_refs",
        "dish_seo_ref",
        "dish_dietary_catalog",
        "dish_allergen_catalog",
      ]),
    );
  });
});
