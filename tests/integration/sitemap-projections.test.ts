import { Mongoose, Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { isPublishedBlogSlug, listPublishedBlogsForSitemap } from "@/server/modules/blogs";
import {
  isPublishedCategorySlug,
  listPublishedCategoriesForSitemap,
} from "@/server/modules/categories";
import { isAvailableDishSlug, listAvailableDishesForSitemap } from "@/server/modules/dishes";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

describe("sitemap public projections", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;
  const at = new Date("2026-09-24T12:00:00.000Z");
  const before = new Date("2026-09-23T12:00:00.000Z");
  const after = new Date("2026-09-25T12:00:00.000Z");
  const base = (slug: string, status: string) => ({
    _id: new Types.ObjectId(),
    slug,
    status,
    translations: [{ locale: "en" }, { locale: "fa" }],
    deletedAt: null,
    updatedAt: before,
  });

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-sitemap-projection-test");
    client = new Mongoose();
    await client.connect(database.uri);
    const db = client.connection.db!;
    await db
      .collection("categories")
      .insertMany([
        base("published-category", "published"),
        base("draft-category", "draft"),
        { ...base("deleted-category", "published"), deletedAt: before },
      ]);
    await db.collection("dishes").insertMany([
      { ...base("available-dish", "published"), availability: { mode: "available" } },
      { ...base("unavailable-dish", "published"), availability: { mode: "unavailable" } },
      {
        ...base("current-scheduled-dish", "published"),
        availability: { mode: "scheduled", availableFrom: before, availableUntil: after },
      },
      {
        ...base("future-dish", "published"),
        availability: { mode: "scheduled", availableFrom: after, availableUntil: null },
      },
      { ...base("draft-dish", "draft"), availability: { mode: "available" } },
    ]);
    await db.collection("blogs").insertMany([
      { ...base("published-blog", "published"), publishedAt: before },
      { ...base("future-blog", "published"), publishedAt: after },
      { ...base("scheduled-blog", "scheduled"), publishedAt: null },
      { ...base("draft-blog", "draft"), publishedAt: null },
    ]);
  }, 120_000);

  afterAll(async () => {
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  it("returns only published categories", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    await expect(listPublishedCategoriesForSitemap(client.connection)).resolves.toMatchObject([
      { slug: "published-category", locales: ["en", "fa"], updatedAt: before },
    ]);
    await expect(isPublishedCategorySlug(client.connection, "published-category")).resolves.toBe(
      true,
    );
    await expect(isPublishedCategorySlug(client.connection, "draft-category")).resolves.toBe(false);
  });

  it("returns only currently available published dishes", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const entries = await listAvailableDishesForSitemap(client.connection, at);
    expect(entries.map((entry) => entry.slug)).toEqual([
      "available-dish",
      "current-scheduled-dish",
    ]);
    await expect(
      isAvailableDishSlug(client.connection, "current-scheduled-dish", at),
    ).resolves.toBe(true);
    await expect(isAvailableDishSlug(client.connection, "future-dish", at)).resolves.toBe(false);
  });

  it("returns only already-published blogs", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    await expect(listPublishedBlogsForSitemap(client.connection, at)).resolves.toMatchObject([
      { slug: "published-blog", locales: ["en", "fa"], updatedAt: before },
    ]);
    await expect(isPublishedBlogSlug(client.connection, "published-blog", at)).resolves.toBe(true);
    await expect(isPublishedBlogSlug(client.connection, "future-blog", at)).resolves.toBe(false);
  });
});
