import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { BlogSnapshot } from "@/server/modules/blogs";
import type { CategorySnapshot } from "@/server/modules/categories";
import type { DishSnapshot } from "@/server/modules/dishes";
import {
  HOMEPAGE_MAX_FEATURED_DISHES,
  HomepageSettingsReferenceError,
  parseHomepageSettings,
  validateHomepageSettingsReferences,
  type HomepageReferenceDependencies,
  type HomepageSettingsData,
  type HomepageSettingsPayload,
} from "@/server/modules/settings";

const ids = {
  hero: "000000000000000000000001",
  featured: "000000000000000000000002",
  discounted: "000000000000000000000003",
  category: "000000000000000000000004",
  blog: "000000000000000000000005",
};

function payload(): HomepageSettingsPayload {
  return {
    data: {
      heroSlides: [
        {
          id: "welcome",
          imageMediaId: ids.hero,
          mobileImageMediaId: null,
          href: "/menu",
          openInNewTab: false,
          enabled: true,
        },
      ],
      linkedBanners: [],
      featuredDishIds: [ids.featured],
      benefits: [{ id: "homemade", iconMediaId: null, enabled: true }],
      testimonials: [{ id: "guest-one", avatarMediaId: null, rating: 5, enabled: true }],
      categoryBanners: [{ categoryId: ids.category, imageMediaId: null, enabled: true }],
      discountedSection: {
        enabled: true,
        mode: "curated",
        dishIds: [ids.discounted],
        limit: 6,
      },
      blogIds: [ids.blog],
    },
    translations: [
      {
        locale: "en",
        value: {
          heroSlides: [
            {
              id: "welcome",
              title: "Persian food made at home",
              description: "Fresh dishes delivered across Porto.",
              ctaLabel: "See the menu",
              imageAlt: "A table of Persian dishes",
            },
          ],
          linkedBanners: [],
          benefits: [{ id: "homemade", title: "Homemade", description: "Prepared with care." }],
          testimonials: [
            { id: "guest-one", authorName: "Guest", authorRole: "", quote: "Delicious." },
          ],
          categoryBanners: [
            { categoryId: ids.category, title: "Main dishes", imageAlt: "Main dishes" },
          ],
          sectionTitles: {
            featured: "Featured dishes",
            benefits: "Why Sara Kitchen",
            testimonials: "What guests say",
            categories: "Categories",
            discounted: "Special offers",
            blog: "From our kitchen",
          },
        },
      },
    ],
  };
}

function dish(id: string, status: "draft" | "published" | "archived" = "published") {
  return {
    id,
    status,
    deletedAt: null,
    availability: { mode: "available", availableFrom: null, availableUntil: null },
  } as DishSnapshot;
}

function category(id: string, status: "draft" | "published" | "archived" = "published") {
  return { id, status, deletedAt: null } as CategorySnapshot;
}

function blog(id: string, status: "draft" | "published" | "archived" = "published") {
  return { id, status, deletedAt: null } as BlogSnapshot;
}

function dependencies(overrides: Partial<HomepageReferenceDependencies> = {}) {
  const defaults: HomepageReferenceDependencies = {
    getMedia: async (mediaIds) =>
      mediaIds.map((id) => ({ id, kind: "image" as const, processingState: "ready" as const })),
    getDish: async (id) => dish(id),
    getCategory: async (id) => category(id),
    getBlog: async (id) => blog(id),
  };
  return { ...defaults, ...overrides };
}

describe("homepage settings", () => {
  it("accepts every homepage section and preserves array order", () => {
    const parsed = parseHomepageSettings(payload());
    expect(parsed.data.heroSlides.map(({ id }) => id)).toEqual(["welcome"]);
    expect(parsed.data.featuredDishIds).toEqual([ids.featured]);
    expect(parsed.data.discountedSection.dishIds).toEqual([ids.discounted]);
    expect(parsed.data.blogIds).toEqual([ids.blog]);
  });

  it("rejects more than six featured dishes and duplicate selections", () => {
    const tooMany = payload();
    tooMany.data.featuredDishIds = Array.from(
      { length: HOMEPAGE_MAX_FEATURED_DISHES + 1 },
      (_, index) => index.toString(16).padStart(24, "0"),
    );
    expect(() => parseHomepageSettings(tooMany)).toThrow();

    const duplicate = payload();
    duplicate.data.featuredDishIds = [ids.featured, ids.featured];
    expect(() => parseHomepageSettings(duplicate)).toThrow(/unique/u);
  });

  it("requires canonical English coverage and safe public links", () => {
    const incomplete = payload();
    incomplete.translations[0]!.value.heroSlides = [];
    expect(() => parseHomepageSettings(incomplete)).toThrow(/Canonical English/u);

    const unsafe = payload();
    unsafe.data.heroSlides[0]!.href = "/dashboard/admins";
    expect(() => parseHomepageSettings(unsafe)).toThrow(/public internal path/u);
  });

  it("rejects archived and missing references while saving a draft", async () => {
    const value = payload().data;
    const promise = validateHomepageSettingsReferences(
      value,
      dependencies({
        getDish: async (id) => (id === ids.featured ? dish(id, "archived") : null),
        getCategory: async (id) => category(id, "archived"),
      }),
      "draft",
    );
    await expect(promise).rejects.toBeInstanceOf(HomepageSettingsReferenceError);
    await expect(promise).rejects.toMatchObject({
      issues: expect.arrayContaining([
        { code: "archived", id: ids.featured, kind: "dish" },
        { code: "missing", id: ids.discounted, kind: "dish" },
        { code: "archived", id: ids.category, kind: "category" },
      ]),
    });
  });

  it("requires publishable content and ready image media at publication", async () => {
    const value: HomepageSettingsData = payload().data;
    await expect(
      validateHomepageSettingsReferences(
        value,
        dependencies({
          getMedia: async (mediaIds) =>
            mediaIds.map((id) => ({ id, kind: "video", processingState: "processing" })),
          getDish: async (id) => dish(id, "draft"),
          getBlog: async (id) => blog(id, "draft"),
        }),
        "publish",
      ),
    ).rejects.toMatchObject({
      issues: expect.arrayContaining([
        { code: "wrong_media_kind", id: ids.hero, kind: "media" },
        { code: "unpublished", id: ids.featured, kind: "dish" },
        { code: "unpublished", id: ids.blog, kind: "blog" },
      ]),
    });
  });

  it("accepts valid published references", async () => {
    await expect(
      validateHomepageSettingsReferences(payload().data, dependencies(), "publish"),
    ).resolves.toBeUndefined();
  });
});
