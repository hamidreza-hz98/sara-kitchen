import { Mongoose, Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  StaticSeoRepositoryConflictError,
  createStaticSeoRepository,
  getPageSeoModel,
  type StaticSeoWrite,
} from "@/server/modules/seo";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

const actorId = "a".repeat(24);
const write: StaticSeoWrite = {
  translations: [
    {
      locale: "en",
      title: "Sara Kitchen",
      description: "Homemade Persian food delivered across Porto.",
      keywords: ["Persian food"],
      openGraph: { title: null, description: null },
      twitter: { title: null, description: null },
    },
  ],
  canonicalUrl: "https://sarakitchen.pt/",
  robots: {
    index: true,
    follow: true,
    noArchive: false,
    noImageIndex: false,
    noSnippet: false,
    maxSnippet: -1,
    maxImagePreview: "large",
    maxVideoPreview: -1,
  },
  openGraph: { type: "website", siteName: "Sara Kitchen" },
  twitter: { card: "summary_large_image", site: null, creator: null },
  shareImageMediaId: null,
  structuredData: { types: ["web-page"], inputs: {} },
  active: true,
};

describe("static SEO persistence", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-static-seo-test");
    client = new Mongoose();
    await client.connect(database.uri);
    await getPageSeoModel(client.connection).init();
  }, 120_000);

  afterAll(async () => {
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  it("persists only registry routes and rejects duplicate static targets", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const repository = createStaticSeoRepository(client.connection);
    const home = await repository.create("home", write, actorId);
    expect(home).toMatchObject({ key: "home", path: "/", slug: "home" });
    await expect(repository.create("home", write, actorId)).rejects.toBeInstanceOf(
      StaticSeoRepositoryConflictError,
    );
    const menu = await repository.create("menu", { ...write, canonicalUrl: null }, actorId);
    expect(menu).toMatchObject({ key: "menu", path: "/menu", slug: "menu" });
    expect(await repository.list()).toHaveLength(2);
  });

  it("uses optimistic writes and records every field as manually managed", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const repository = createStaticSeoRepository(client.connection);
    const current = await repository.findByKey("home");
    if (!current) throw new Error("Home SEO was not created.");
    const saved = await repository.save(
      current,
      {
        ...write,
        translations: [{ ...write.translations[0]!, title: "Sara Kitchen Porto" }],
      },
      actorId,
    );
    expect(saved.translations[0]?.title).toBe("Sara Kitchen Porto");
    await expect(repository.save(current, write, actorId)).rejects.toBeInstanceOf(
      StaticSeoRepositoryConflictError,
    );
    const document = await client.connection
      .collection("seo_pages")
      .findOne({ _id: new Types.ObjectId(saved.id) });
    expect(document?.manualOverrides.root).toEqual(
      expect.arrayContaining(["route", "canonicalUrl", "shareImage", "structuredData"]),
    );
    expect(document?.manualOverrides.translations[0].fields).toContain("title");
  });
});
