import { createConnection, Types } from "mongoose";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  INGREDIENT_ALLERGEN_TAGS,
  getIngredientModel,
  ingredientSchema,
} from "@/server/modules/ingredients/model/ingredient";

const Ingredient = getIngredientModel(createConnection());

function ingredient(overrides: Record<string, unknown> = {}) {
  return new Ingredient({
    translations: [{ locale: "en", name: "Saffron" }],
    ...overrides,
  });
}

describe("Ingredient schema", () => {
  it("stores translations, normalized search data, allergens, status, and base metadata", async () => {
    const imageMediaId = new Types.ObjectId();
    const document = ingredient({
      translations: [
        { locale: "en", name: "Crème & Milk" },
        { locale: "pt-PT", name: "Natas e leite" },
        { locale: "fa", name: "خامه و شیر" },
      ],
      imageMediaId,
      allergenTags: ["milk"],
      status: "published",
    });
    await expect(document.validate()).resolves.toBeUndefined();
    expect(document.canonicalNameKey).toBe("creme milk");
    expect(document.get("normalizedSearchText")).toContain("natas e leite");
    expect(document.imageMediaId).toEqual(imageMediaId);
    expect(document.allergenTags).toEqual(["milk"]);
    expect(document.toJSON()).toMatchObject({ id: document._id.toHexString(), schemaVersion: 1 });
  });

  it.each([
    [{ translations: [] }, /translations/u],
    [{ translations: [{ locale: "fa", name: "زعفران" }] }, /translations/u],
    [{ translations: [{ locale: "en", name: " " }] }, /translations/u],
    [
      {
        translations: [
          { locale: "en", name: "Saffron" },
          { locale: "en", name: "Safran" },
        ],
      },
      /translations/u,
    ],
    [{ imageMediaId: "not-an-object-id" }, /imageMediaId/u],
    [{ allergenTags: ["milk", "milk"] }, /allergenTags/u],
    [{ allergenTags: ["unknown"] }, /allergenTags/u],
    [{ status: "hidden" }, /status/u],
  ])("rejects invalid ingredient data: %j", async (overrides, expected) => {
    await expect(ingredient(overrides).validate()).rejects.toThrow(expected);
  });

  it("publishes the complete stable allergen code set", () => {
    expect(INGREDIENT_ALLERGEN_TAGS).toHaveLength(14);
    expect(INGREDIENT_ALLERGEN_TAGS).toEqual(
      expect.arrayContaining(["gluten", "milk", "tree_nuts", "sulphites"]),
    );
  });

  it("declares duplicate, list, search, media, and allergen indexes", () => {
    const indexes = ingredientSchema.indexes();
    expect(
      indexes.find(
        ([, options]) => options.name === "ingredient_active_canonical_name_unique",
      )?.[1],
    ).toMatchObject({ unique: true });
    expect(indexes.map(([, options]) => options.name)).toEqual(
      expect.arrayContaining([
        "ingredient_active_status_name",
        "ingredient_text_search",
        "ingredient_image_media_ref",
        "ingredient_allergens_status",
      ]),
    );
  });
});
