import { createConnection, Types } from "mongoose";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  BLOG_MAX_READ_TIME_MINUTES,
  BLOG_MAX_RELATIONS,
  BLOG_MAX_TAGS,
  blogSchema,
  getBlogModel,
} from "@/server/modules/blogs/model/blog";

const Blog = getBlogModel(createConnection());

function content(nodes: readonly unknown[] = [{ type: "paragraph" }]) {
  return { schemaVersion: 1, document: { type: "doc", content: nodes } };
}

function blog(overrides: Record<string, unknown> = {}) {
  return new Blog({
    translations: [
      {
        locale: "en",
        title: "How to serve Fesenjan",
        excerpt: "A guide to a classic Persian walnut stew.",
        content: content(),
      },
    ],
    authorAdminId: new Types.ObjectId(),
    authorSnapshot: { displayName: "Chef Sara Kazemi" },
    ...overrides,
  });
}

describe("Blog schema", () => {
  it("stores the complete translated publishing aggregate and stable defaults", async () => {
    const authorAdminId = new Types.ObjectId();
    const imageMediaId = new Types.ObjectId();
    const bannerMediaId = new Types.ObjectId();
    const relatedDishId = new Types.ObjectId();
    const relatedBlogId = new Types.ObjectId();
    const seoPageId = new Types.ObjectId();
    const publishedAt = new Date("2026-09-24T08:00:00.000Z");
    const document = blog({
      translations: [
        {
          locale: "en",
          title: "How to serve Fesenjan",
          excerpt: "A guide to a classic Persian walnut stew.",
          content: content(),
        },
        {
          locale: "pt-PT",
          title: "Como servir Fesenjan",
          excerpt: "Um guia para o clássico guisado persa de nozes.",
          content: content(),
        },
        {
          locale: "fa",
          title: "روش سرو فسنجان",
          excerpt: "راهنمای سرو خورش سنتی گردو.",
          content: content(),
        },
      ],
      authorAdminId,
      authorSnapshot: { displayName: "  Chef   Sara Kazemi  " },
      imageMediaId,
      bannerMediaId,
      readTimeMinutes: 8,
      status: "published",
      publishedAt,
      tags: ["persian-food", "cooking-guides"],
      relatedDishIds: [relatedDishId],
      relatedBlogIds: [relatedBlogId],
      viewCount: 120,
      seoPageId,
    });

    await expect(document.validate()).resolves.toBeUndefined();
    expect(document.slug).toBe("how-to-serve-fesenjan");
    expect(document.authorSnapshot.displayName).toBe("Chef Sara Kazemi");
    expect(document.translations).toHaveLength(3);
    expect(document.toJSON()).toMatchObject({
      id: document._id.toHexString(),
      schemaVersion: 1,
      status: "published",
      viewCount: 120,
    });
  });

  it("generates a stable slug and applies safe draft defaults", async () => {
    const document = blog();
    await expect(document.validate()).resolves.toBeUndefined();
    expect(document).toMatchObject({
      slug: "how-to-serve-fesenjan",
      status: "draft",
      readTimeMinutes: 1,
      publishAt: null,
      publishedAt: null,
      tags: [],
      relatedDishIds: [],
      relatedBlogIds: [],
      viewCount: 0,
    });
    document.translations[0]!.title = "A renamed article";
    await document.validate();
    expect(document.slug).toBe("how-to-serve-fesenjan");
  });

  it.each([
    ["scheduled", { status: "scheduled", publishAt: new Date("2099-01-01T00:00:00.000Z") }],
    ["published", { status: "published", publishedAt: new Date("2026-09-24T08:00:00.000Z") }],
    [
      "unpublished draft retaining first publication",
      { status: "draft", publishedAt: new Date("2026-09-24T08:00:00.000Z") },
    ],
    [
      "re-scheduled publication retaining first publication",
      {
        status: "scheduled",
        publishAt: new Date("2099-01-01T00:00:00.000Z"),
        publishedAt: new Date("2026-09-24T08:00:00.000Z"),
      },
    ],
    [
      "archived publication",
      { status: "archived", publishedAt: new Date("2026-09-24T08:00:00.000Z") },
    ],
  ])("accepts a valid %s lifecycle", async (_label, values) => {
    await expect(blog(values).validate()).resolves.toBeUndefined();
  });

  it.each([
    [{ status: "scheduled" }, /publishAt/u],
    [{ status: "published" }, /publishedAt/u],
    [{ status: "draft", publishAt: new Date("2099-01-01T00:00:00.000Z") }, /publishAt/u],
    [{ status: "hidden" }, /status/u],
  ])("rejects an invalid publishing lifecycle: %j", async (values, expected) => {
    await expect(blog(values).validate()).rejects.toThrow(expected);
  });

  it("rejects incomplete translations and malformed or oversized rich content", async () => {
    const cases: [Record<string, unknown>, RegExp][] = [
      [{ translations: [] }, /translations/u],
      [
        {
          translations: [
            {
              locale: "fa",
              title: "نوشته",
              excerpt: "خلاصه",
              content: content([]),
            },
          ],
        },
        /translations/u,
      ],
      [
        {
          translations: [
            {
              locale: "en",
              title: "Article",
              excerpt: "Excerpt",
              content: content([]),
            },
            {
              locale: "en",
              title: "Duplicate",
              excerpt: "Excerpt",
              content: content([]),
            },
          ],
        },
        /translations/u,
      ],
      [
        {
          translations: [{ locale: "en", title: "Article", excerpt: "Excerpt", content: "unsafe" }],
        },
        /content/u,
      ],
      [
        {
          translations: [
            {
              locale: "en",
              title: "Article",
              excerpt: "Excerpt",
              content: content([
                { type: "paragraph", content: [{ type: "text", text: "x".repeat(500_001) }] },
              ]),
            },
          ],
        },
        /content/u,
      ],
    ];

    for (const [overrides, expected] of cases) {
      await expect(blog(overrides).validate()).rejects.toThrow(expected);
    }
  });

  it("rejects invalid references, metrics, tags, and self-relations", async () => {
    const duplicate = new Types.ObjectId();
    const cases: [Record<string, unknown>, RegExp][] = [
      [{ slug: "blog" }, /slug/u],
      [{ slug: "Invalid Slug" }, /slug/u],
      [{ imageMediaId: "invalid" }, /imageMediaId/u],
      [{ bannerMediaId: "invalid" }, /bannerMediaId/u],
      [{ authorAdminId: "invalid" }, /authorAdminId/u],
      [{ authorSnapshot: { displayName: " " } }, /displayName/u],
      [{ readTimeMinutes: 0 }, /readTimeMinutes/u],
      [{ readTimeMinutes: BLOG_MAX_READ_TIME_MINUTES + 1 }, /readTimeMinutes/u],
      [{ viewCount: -1 }, /viewCount/u],
      [{ viewCount: 1.5 }, /viewCount/u],
      [{ tags: ["Persian Food"] }, /tags/u],
      [{ tags: ["persian", "persian"] }, /tags/u],
      [{ tags: Array.from({ length: BLOG_MAX_TAGS + 1 }, (_, index) => `tag-${index}`) }, /tags/u],
      [{ relatedDishIds: [duplicate, duplicate] }, /relatedDishIds/u],
      [
        {
          relatedDishIds: Array.from(
            { length: BLOG_MAX_RELATIONS + 1 },
            () => new Types.ObjectId(),
          ),
        },
        /relatedDishIds/u,
      ],
      [{ relatedBlogIds: [duplicate, duplicate] }, /relatedBlogIds/u],
      [{ seoPageId: "invalid" }, /seoPageId/u],
    ];

    for (const [overrides, expected] of cases) {
      await expect(blog(overrides).validate()).rejects.toThrow(expected);
    }

    const self = blog();
    self.relatedBlogIds = [self._id];
    await expect(self.validate()).rejects.toThrow(/relatedBlogIds/u);
  });

  it("declares unique slug, publishing, relation, search, and lookup indexes", () => {
    const indexes = blogSchema.indexes();
    expect(indexes.find(([fields]) => fields.slug === 1)?.[1]).toMatchObject({ unique: true });
    expect(indexes.map(([, options]) => options.name)).toEqual(
      expect.arrayContaining([
        "blog_public_listing",
        "blog_publish_schedule",
        "blog_text_search",
        "blog_author_listing",
        "blog_tag_listing",
        "blog_image_media_ref",
        "blog_banner_media_ref",
        "blog_related_dish_refs",
        "blog_related_blog_refs",
        "blog_popular_listing",
        "blog_seo_ref",
      ]),
    );
    expect(blogSchema.path("publishedAt").options).toMatchObject({ default: null });
  });
});
