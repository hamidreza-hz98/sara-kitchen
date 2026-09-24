import { Mongoose, Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { BlogSnapshot } from "@/server/modules/blogs";
import type { CategorySnapshot } from "@/server/modules/categories";
import type { DishSnapshot } from "@/server/modules/dishes";
import {
  AutomaticSeoError,
  createAutomaticSeoSynchronizer,
  getPageSeoModel,
} from "@/server/modules/seo";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

const now = "2026-09-24T12:00:00.000Z";

function category(overrides: Partial<CategorySnapshot> = {}): CategorySnapshot {
  return {
    id: new Types.ObjectId().toHexString(),
    translations: [
      { locale: "en", name: "Persian stews", description: "Slow-cooked Persian favourites." },
      { locale: "pt-PT", name: "Guisados persas", description: "Clássicos persas caseiros." },
    ],
    slug: "persian-stews",
    bannerMediaId: null,
    imageMediaId: new Types.ObjectId().toHexString(),
    seoPageId: null,
    status: "published",
    sortOrder: 1,
    deletedAt: null,
    version: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function dish(overrides: Partial<DishSnapshot> = {}): DishSnapshot {
  return {
    id: new Types.ObjectId().toHexString(),
    translations: [
      {
        locale: "en",
        name: "Fesenjan",
        excerpt: "Walnut and pomegranate stew.",
        specifications: [],
      },
    ],
    slug: "fesenjan",
    mediaIds: [new Types.ObjectId().toHexString()],
    categoryIds: [],
    ingredients: [],
    basePriceCents: 1_400,
    discount: { type: "none", amountCents: null, basisPoints: null, startsAt: null, endsAt: null },
    portionAmount: 1,
    portionUnit: "serving",
    availability: { mode: "available", availableFrom: null, availableUntil: null },
    leadTimeMinutes: 1_440,
    maxQuantityPerOrder: 10,
    mayContainAllergenTags: ["tree_nuts"],
    dietaryTags: ["halal"],
    isFeatured: true,
    featuredOrder: 1,
    relatedDishIds: [],
    relatedBlogIds: [],
    seoPageId: null,
    soldCount: 0,
    viewCount: 0,
    status: "published",
    deletedAt: null,
    version: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function blog(overrides: Partial<BlogSnapshot> = {}): BlogSnapshot {
  return {
    id: new Types.ObjectId().toHexString(),
    translations: [
      {
        locale: "en",
        title: "How to serve Fesenjan",
        excerpt: "A guide to the classic Persian stew.",
        content: { schemaVersion: 1, document: { type: "doc", content: [] } },
      },
    ],
    slug: "serve-fesenjan",
    imageMediaId: new Types.ObjectId().toHexString(),
    bannerMediaId: null,
    readTimeMinutes: 4,
    authorAdminId: new Types.ObjectId().toHexString(),
    authorSnapshot: { displayName: "Chef Sara" },
    status: "published",
    publishAt: null,
    publishedAt: now,
    tags: ["persian-food"],
    relatedDishIds: [],
    relatedBlogIds: [],
    viewCount: 0,
    seoPageId: null,
    deletedAt: null,
    version: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("automatic entity SEO", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-automatic-seo-test");
    client = new Mongoose();
    await client.connect(database.uri);
  }, 120_000);

  afterAll(async () => {
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  it("creates idempotent defaults for category, dish, and blog entities", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const sync = createAutomaticSeoSynchronizer(client.connection, {
      siteUrl: "https://sarakitchen.pt",
    });
    const categoryValue = category();
    const dishValue = dish();
    const blogValue = blog();

    const [categorySeoId, dishSeoId, blogSeoId] = await Promise.all([
      sync.category(categoryValue),
      sync.dish(dishValue),
      sync.blog(blogValue),
    ]);
    await expect(sync.category(categoryValue)).resolves.toBe(categorySeoId);

    const PageSeo = getPageSeoModel(client.connection);
    const records = await PageSeo.find({ _id: { $in: [categorySeoId, dishSeoId, blogSeoId] } });
    expect(records).toHaveLength(3);
    expect(records.map((value) => value.path)).toEqual(
      expect.arrayContaining([
        "/menu/category/persian-stews",
        "/menu/fesenjan",
        "/blog/serve-fesenjan",
      ]),
    );
    expect(records.find((value) => value.entityKind === "dish")).toMatchObject({
      openGraph: { type: "product" },
      structuredData: { types: ["web-page", "product", "breadcrumb-list"] },
    });
  });

  it("regenerates automatic fields while preserving granular manual overrides", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const sync = createAutomaticSeoSynchronizer(client.connection, {
      siteUrl: "https://sarakitchen.pt",
    });
    const original = category({ slug: "main-courses" });
    const id = await sync.category(original);
    const PageSeo = getPageSeoModel(client.connection);
    const document = await PageSeo.findById(id);
    if (!document) throw new Error("SEO record was not created.");

    document.canonicalUrl = "https://sarakitchen.pt/featured/main-courses";
    const english = document.translations.find((entry) => entry.locale === "en");
    if (!english) throw new Error("English SEO translation was not created.");
    english.title = "Chef Sara's hand-picked meals";
    document.manualOverrides.root = ["canonicalUrl"];
    document.manualOverrides.translations = [{ locale: "en", fields: ["title"] }];
    await document.save();

    await sync.category(
      category({
        ...original,
        slug: "chef-specials",
        translations: [
          { locale: "en", name: "Chef specials", description: "A newly updated description." },
          { locale: "pt-PT", name: "Especiais da chef", description: "Descrição atualizada." },
        ],
      }),
    );

    const updated = await PageSeo.findById(id);
    expect(updated).toMatchObject({
      path: "/menu/category/chef-specials",
      slug: "chef-specials",
      canonicalUrl: "https://sarakitchen.pt/featured/main-courses",
    });
    expect(updated?.translations.find((entry) => entry.locale === "en")).toMatchObject({
      title: "Chef Sara's hand-picked meals",
      description: "A newly updated description.",
    });
    expect(updated?.translations.find((entry) => entry.locale === "pt-PT")).toMatchObject({
      title: "Especiais da chef",
      description: "Descrição atualizada.",
    });
  });

  it("fails loudly when SEO persistence is unavailable", async () => {
    const disconnected = new Mongoose();
    disconnected.set("bufferCommands", false);
    const sync = createAutomaticSeoSynchronizer(disconnected.connection, {
      siteUrl: "https://sarakitchen.pt",
    });
    await expect(sync.category(category())).rejects.toBeInstanceOf(AutomaticSeoError);
  });
});
