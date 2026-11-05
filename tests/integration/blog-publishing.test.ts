import { Mongoose } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createStoredRichText } from "@/lib/rich-text";
import {
  createBlogRepository,
  createBlogServices,
  createBlogViewRepository,
  evaluateBlogViewSignal,
  getBlogModel,
  getBlogViewReceiptModel,
} from "@/server/modules/blogs";
import { createAutomaticSeoSynchronizer, getPageSeoModel } from "@/server/modules/seo";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

const authorId = "1".repeat(24);
const content = createStoredRichText({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Article" }] }],
});

describe("blog publishing persistence", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-blog-publishing-test");
    client = new Mongoose();
    await client.connect(database.uri);
  }, 120_000);

  afterAll(async () => {
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  it("creates a blog with plain translation and author data and synchronizes SEO", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const repository = createBlogRepository(client.connection);
    const seo = createAutomaticSeoSynchronizer(client.connection, {
      siteUrl: "https://example.com",
    });
    const service = createBlogServices({
      repository,
      seo: { sync: seo.blog, remove: async () => undefined },
      inspectReferences: async () => ({ missing: [], archived: [] }),
      removeInboundDishRelationships: async () => [],
      audit: async () => undefined,
      invalidate: () => undefined,
      previewSecret: "preview-secret-longer-than-thirty-two-characters",
    });
    const created = await service.create(
      { id: authorId, displayName: "Sara Kazemi", role: "content_editor" },
      {
        translations: [{ locale: "en", title: "Create a blog", excerpt: "", content }],
      },
    );
    expect(created.translations).toEqual([
      { locale: "en", title: "Create a blog", excerpt: "", content },
    ]);
    expect(created.authorSnapshot).toEqual({ displayName: "Sara Kazemi" });
    expect(created.seoPageId).toBeTruthy();
    expect(
      await getPageSeoModel(client.connection).findById(created.seoPageId).lean(),
    ).toMatchObject({ entityKind: "blog" });
    expect((await repository.findById(created.id))?.translations).toEqual(created.translations);
    const actor = { id: authorId, displayName: "Sara Kazemi", role: "content_editor" as const };
    await service.publish(actor, created.id);
    await expect(service.getPublicBySlug(created.slug, "fa")).resolves.toMatchObject({
      title: "Create a blog",
      excerpt: "",
    });
    await service.unpublish(actor, created.id);
  }, 30_000);

  it("never exposes draft, scheduled, or archived content through public repository reads", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const Blog = getBlogModel(client.connection);
    await Blog.init();
    const base = {
      translations: [
        { locale: "en" as const, title: "Private article", excerpt: "Excerpt", content },
      ],
      authorAdminId: authorId,
      authorSnapshot: { displayName: "Sara Kazemi" },
    };
    const [draft, scheduled, published, archived, futurePublished] = await Promise.all([
      new Blog({ ...base, slug: "draft-article", status: "draft" }).save(),
      new Blog({
        ...base,
        slug: "scheduled-article",
        status: "scheduled",
        publishAt: new Date("2099-01-01"),
      }).save(),
      new Blog({
        ...base,
        slug: "published-article",
        status: "published",
        publishedAt: new Date("2026-09-24"),
      }).save(),
      new Blog({
        ...base,
        slug: "archived-article",
        status: "archived",
        publishedAt: new Date("2026-09-23"),
      }).save(),
      new Blog({
        ...base,
        slug: "future-published-article",
        status: "published",
        publishedAt: new Date("2099-01-01"),
      }).save(),
    ]);
    const repository = createBlogRepository(client.connection);
    await expect(repository.findBySlug(draft.slug, true)).resolves.toBeNull();
    await expect(repository.findBySlug(scheduled.slug, true)).resolves.toBeNull();
    await expect(repository.findBySlug(archived.slug, true)).resolves.toBeNull();
    await expect(repository.findBySlug(futurePublished.slug, true)).resolves.toBeNull();
    await expect(repository.findBySlug(published.slug, true)).resolves.toMatchObject({
      id: published._id.toHexString(),
    });
    const result = await repository.listPublic({ page: 1, pageSize: 20 });
    expect(result.items.map((item) => item.slug)).toEqual(["published-article"]);
  });

  it("atomically promotes due schedules and counts one meaningful viewer per window", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const Blog = getBlogModel(client.connection);
    const Receipt = getBlogViewReceiptModel(client.connection);
    await Promise.all([Blog.init(), Receipt.init()]);
    const due = await Blog.create({
      translations: [{ locale: "en", title: "Due article", excerpt: "Excerpt", content }],
      slug: "due-article",
      authorAdminId: authorId,
      authorSnapshot: { displayName: "Sara Kazemi" },
      status: "scheduled",
      publishAt: new Date("2026-09-24T11:00:00.000Z"),
    });
    const repository = createBlogRepository(client.connection);
    const published = await repository.publishDue(new Date("2026-09-24T12:00:00.000Z"));
    expect(published).toHaveLength(1);
    expect(published[0]).toMatchObject({
      id: due._id.toHexString(),
      status: "published",
      publishAt: null,
      publishedAt: "2026-09-24T12:00:00.000Z",
    });
    await expect(repository.publishDue(new Date("2026-09-24T12:01:00.000Z"))).resolves.toEqual([]);

    const decision = evaluateBlogViewSignal(
      {
        blogId: due._id.toHexString(),
        userAgent: "Mozilla/5.0 integration browser",
        clientAddress: "192.0.2.88",
        engagementMs: 4_000,
        visibilityState: "visible",
      },
      {
        secret: "blog-view-secret-at-least-thirty-two-characters",
        at: new Date("2026-09-24T12:10:00.000Z"),
      },
    );
    if (!decision.countable) throw new Error("Fixture must be countable.");
    const views = createBlogViewRepository(client.connection);
    const results = await Promise.all(
      Array.from({ length: 10 }, () => views.count(decision.candidate)),
    );
    expect(results.filter((value) => value === "counted")).toHaveLength(1);
    expect((await Blog.findById(due._id))?.viewCount).toBe(1);
  });
});
