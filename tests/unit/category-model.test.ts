import { createConnection, Types } from "mongoose";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { categorySchema, getCategoryModel } from "@/server/modules/categories/model/category";

const Category = getCategoryModel(createConnection());

function category(overrides: Record<string, unknown> = {}) {
  return new Category({
    translations: [{ locale: "en", name: "Persian starters", description: "Traditional starters" }],
    ...overrides,
  });
}

describe("Category schema", () => {
  it("generates a stable English slug and serializes base metadata", async () => {
    const document = category();
    await expect(document.validate()).resolves.toBeUndefined();
    expect(document.slug).toBe("persian-starters");
    expect(document.status).toBe("draft");
    expect(document.sortOrder).toBe(0);
    expect(document.toJSON()).toMatchObject({ id: document._id.toHexString(), schemaVersion: 1 });
    document.translations[0]!.name = "Renamed starters";
    await document.validate();
    expect(document.slug).toBe("persian-starters");
  });

  it("accepts translated content and image media references", async () => {
    const banner = new Types.ObjectId();
    const image = new Types.ObjectId();
    const document = category({
      translations: [
        { locale: "en", name: "Rice dishes", description: "Rice dishes" },
        { locale: "pt-PT", name: "Pratos de arroz", description: "Descrição" },
        { locale: "fa", name: "غذاهای برنجی", description: "توضیح" },
      ],
      bannerMediaId: banner,
      imageMediaId: image,
      seoPageId: new Types.ObjectId(),
      status: "published",
      sortOrder: 10,
    });
    await expect(document.validate()).resolves.toBeUndefined();
    expect(document.bannerMediaId).toEqual(banner);
    expect(document.imageMediaId).toEqual(image);
    expect(document.translations).toHaveLength(3);
  });

  it.each([
    [{ translations: [] }, /translations/u],
    [{ translations: [{ locale: "fa", name: "غذا" }] }, /translations/u],
    [{ translations: [{ locale: "en", name: " " }] }, /translations/u],
    [
      {
        translations: [
          { locale: "en", name: "Food" },
          { locale: "en", name: "More" },
        ],
      },
      /translations/u,
    ],
    [{ slug: "menu" }, /slug/u],
    [{ slug: "Invalid Slug" }, /slug/u],
    [{ status: "hidden" }, /status/u],
    [{ sortOrder: -1 }, /sortOrder/u],
    [{ sortOrder: 1.5 }, /sortOrder/u],
    [{ bannerMediaId: "not-an-id" }, /bannerMediaId/u],
    [{ imageMediaId: "not-an-id" }, /imageMediaId/u],
    [{ seoPageId: "not-an-id" }, /seoPageId/u],
  ])("rejects invalid category data: %j", async (overrides, expected) => {
    await expect(category(overrides).validate()).rejects.toThrow(expected);
  });

  it("declares slug uniqueness and catalog/reference indexes", () => {
    const indexes = categorySchema.indexes();
    expect(indexes.find(([fields]) => fields.slug === 1)?.[1]).toMatchObject({ unique: true });
    expect(indexes.map(([, options]) => options.name)).toEqual(
      expect.arrayContaining([
        "category_status_sort",
        "category_active_status_sort",
        "category_text_search",
        "category_banner_media_ref",
        "category_image_media_ref",
        "category_seo_ref",
      ]),
    );
  });
});
