import { createConnection, Types } from "mongoose";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  SEO_MAX_KEYWORDS,
  SEO_MAX_STRUCTURED_DATA_DEPTH,
  getPageSeoModel,
  isNormalizedSeoPath,
  isSafeCanonicalUrl,
  isSafeStructuredDataInputs,
  pageSeoSchema,
} from "@/server/modules/seo";

const PageSeo = getPageSeoModel(createConnection());

function entitySeo(overrides: Record<string, unknown> = {}) {
  return new PageSeo({
    targetType: "entity",
    entityKind: "dish",
    entityId: new Types.ObjectId(),
    path: "/menu/fesenjan",
    slug: "fesenjan",
    translations: [
      {
        locale: "en",
        title: "Order Fesenjan in Porto",
        description: "Homemade Persian walnut and pomegranate stew, delivered across Porto.",
        keywords: ["fesenjan", "persian-food"],
      },
    ],
    ...overrides,
  });
}

describe("Page SEO schema", () => {
  it("stores a complete locale-aware entity record with safe defaults", async () => {
    const entityId = new Types.ObjectId();
    const shareImageMediaId = new Types.ObjectId();
    const document = entitySeo({
      entityId,
      canonicalUrl: "https://sarakitchen.pt/menu/fesenjan",
      shareImageMediaId,
      translations: [
        {
          locale: "en",
          title: "Order Fesenjan in Porto",
          description: "Homemade Persian walnut and pomegranate stew, delivered across Porto.",
          keywords: ["fesenjan", "persian-food"],
          openGraph: { title: "Fresh Fesenjan", description: "Order homemade Fesenjan." },
          twitter: { title: "Fresh Fesenjan", description: "Order homemade Fesenjan." },
        },
        {
          locale: "pt-PT",
          title: "Encomendar Fesenjan no Porto",
          description: "Guisado persa caseiro de noz e romã, entregue em todo o Porto.",
          keywords: ["fesenjan", "comida-persa"],
        },
        {
          locale: "fa",
          title: "سفارش فسنجان در پورتو",
          description: "خورش فسنجان خانگی با گردو و رب انار، با ارسال در سراسر پورتو.",
          keywords: ["فسنجان", "غذای-ایرانی"],
        },
      ],
      openGraph: { type: "product", siteName: "Sara Kitchen" },
      twitter: { card: "summary_large_image", site: "@sarakitchenpt" },
      structuredData: {
        types: ["web-page", "product", "breadcrumb-list"],
        inputs: { priceCents: 1_400, currency: "EUR", availability: "in-stock" },
      },
    });

    await expect(document.validate()).resolves.toBeUndefined();
    expect(document.targetKey).toBe(`entity:dish:${entityId.toHexString()}`);
    expect(document).toMatchObject({
      active: true,
      robots: {
        index: true,
        follow: true,
        noArchive: false,
        noSnippet: false,
        maxImagePreview: "large",
      },
      shareImageMediaId,
    });
    expect(document.toJSON()).toMatchObject({ id: document._id.toHexString(), schemaVersion: 1 });
  });

  it("stores an exclusive static-page target and supports the root path", async () => {
    const document = entitySeo({
      targetType: "static",
      entityKind: null,
      entityId: null,
      staticPageKey: "home",
      path: "/",
      slug: "home",
    });
    await expect(document.validate()).resolves.toBeUndefined();
    expect(document.targetKey).toBe("static:home");
  });

  it.each([
    [{ targetType: "entity", entityKind: null }, /entityKind/u],
    [{ targetType: "entity", entityId: null }, /entityId/u],
    [{ targetType: "entity", staticPageKey: "about" }, /staticPageKey/u],
    [
      { targetType: "static", entityKind: null, entityId: null, staticPageKey: null },
      /staticPageKey/u,
    ],
    [{ targetType: "static", entityId: null, staticPageKey: "about" }, /entityKind/u],
    [{ targetType: "static", entityKind: null, staticPageKey: "about" }, /entityId/u],
    [{ entityKind: "order" }, /entityKind/u],
    [{ entityId: "invalid" }, /entityId/u],
    [{ shareImageMediaId: "invalid" }, /shareImageMediaId/u],
  ])("rejects invalid or ambiguous target/reference data: %j", async (overrides, expected) => {
    await expect(entitySeo(overrides).validate()).rejects.toThrow(expected);
  });

  it.each([
    [{ path: "menu/fesenjan" }, /path/u],
    [{ path: "/menu/Fesenjan" }, /path/u],
    [{ path: "/menu/fesenjan/" }, /path/u],
    [{ path: "/menu/fesenjan?ref=x" }, /path/u],
    [{ slug: "another-dish" }, /slug/u],
    [{ canonicalUrl: "http://sarakitchen.pt/menu/fesenjan" }, /canonicalUrl/u],
    [{ canonicalUrl: "https://user:secret@sarakitchen.pt/menu/fesenjan" }, /canonicalUrl/u],
    [{ canonicalUrl: "https://sarakitchen.pt/menu/another-dish" }, /canonicalUrl/u],
    [{ canonicalUrl: "https://sarakitchen.pt/menu/fesenjan?campaign=x" }, /canonicalUrl/u],
  ])("rejects non-normalized routing and canonical data: %j", async (overrides, expected) => {
    await expect(entitySeo(overrides).validate()).rejects.toThrow(expected);
  });

  it.each([
    [{ translations: [] }, /translations/u],
    [
      {
        translations: [
          {
            locale: "fa",
            title: "فسنجان",
            description: "توضیح",
          },
        ],
      },
      /translations/u,
    ],
    [
      {
        translations: [
          { locale: "en", title: "Dish", description: "Description" },
          { locale: "en", title: "Duplicate", description: "Description" },
        ],
      },
      /translations/u,
    ],
    [
      {
        translations: [
          {
            locale: "en",
            title: "Dish",
            description: "Description",
            keywords: ["Persian", "persian"],
          },
        ],
      },
      /keywords/u,
    ],
    [
      {
        translations: [
          {
            locale: "en",
            title: "Dish",
            description: "Description",
            keywords: Array.from(
              { length: SEO_MAX_KEYWORDS + 1 },
              (_, index) => `keyword-${index}`,
            ),
          },
        ],
      },
      /keywords/u,
    ],
  ])("rejects invalid translated metadata: %j", async (overrides, expected) => {
    await expect(entitySeo(overrides).validate()).rejects.toThrow(expected);
  });

  it.each([
    [{ robots: { noSnippet: true, maxSnippet: 100 } }, /maxSnippet/u],
    [{ robots: { maxSnippet: -2 } }, /maxSnippet/u],
    [{ robots: { maxImagePreview: "full" } }, /maxImagePreview/u],
    [{ twitter: { site: "sara kitchen" } }, /site/u],
    [{ twitter: { creator: "@handle-is-far-too-long" } }, /creator/u],
    [{ structuredData: { types: ["product", "product"] } }, /types/u],
    [{ structuredData: { types: ["script"] } }, /types/u],
    [{ structuredData: { inputs: { $where: "unsafe" } } }, /inputs/u],
    [{ structuredData: { inputs: { "unsafe.path": true } } }, /inputs/u],
    [{ structuredData: { inputs: { value: Number.NaN } } }, /inputs/u],
  ])("rejects invalid robots, social and structured data: %j", async (overrides, expected) => {
    await expect(entitySeo(overrides).validate()).rejects.toThrow(expected);
  });

  it("validates paths, canonical URLs and bounded structured inputs independently", () => {
    expect(isNormalizedSeoPath("/menu/fesenjan")).toBe(true);
    expect(isNormalizedSeoPath("/menu//fesenjan")).toBe(false);
    expect(isSafeCanonicalUrl("https://sarakitchen.pt/menu/fesenjan", "/menu/fesenjan")).toBe(true);
    expect(isSafeCanonicalUrl("javascript:alert(1)", "/menu/fesenjan")).toBe(false);
    expect(isSafeStructuredDataInputs({ nested: { value: [1, true, null] } })).toBe(true);

    let tooDeep: Record<string, unknown> = {};
    const root = tooDeep;
    for (let index = 0; index <= SEO_MAX_STRUCTURED_DATA_DEPTH; index += 1) {
      tooDeep.child = {};
      tooDeep = tooDeep.child as Record<string, unknown>;
    }
    expect(isSafeStructuredDataInputs(root)).toBe(false);
  });

  it("declares active target/path uniqueness and discovery indexes", () => {
    const indexes = pageSeoSchema.indexes();
    const byName = new Map(indexes.map((entry) => [entry[1].name, entry]));
    expect(indexes.some(([fields, options]) => fields.slug === 1 && options.unique === true)).toBe(
      false,
    );
    expect(byName.get("seo_one_active_target")?.[1]).toMatchObject({
      unique: true,
      partialFilterExpression: { active: true, deletedAt: null },
    });
    expect(byName.get("seo_one_active_path")?.[1]).toMatchObject({
      unique: true,
      partialFilterExpression: { active: true, deletedAt: null },
    });
    expect([...byName.keys()]).toEqual(
      expect.arrayContaining([
        "seo_entity_lookup",
        "seo_static_lookup",
        "seo_share_image_ref",
        "seo_management_list",
      ]),
    );
  });
});
