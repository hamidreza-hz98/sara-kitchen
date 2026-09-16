import { Mongoose } from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createMongoConnectionCache,
  createMongoConnectionManager,
} from "@/server/database/connection-manager";
import { createBaseSchema, type BaseDocumentFields } from "@/server/database/schema";
import { resolveUniqueSlug } from "@/server/slugs/slug-policy";
import { createSlugField } from "@/server/slugs/slug-schema";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

type SlugFixture = BaseDocumentFields & {
  name: string;
  slug: string;
};

describe("persisted slug uniqueness", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-slug-uniqueness-test");
    client = new Mongoose();
  }, 120_000);

  afterAll(async () => {
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  it("selects a free suffix and enforces the final unique database index", async () => {
    const testClient = client;
    const testDatabase = database;
    if (!testClient || !testDatabase) throw new Error("Test MongoDB did not start.");

    const manager = createMongoConnectionManager({
      cache: createMongoConnectionCache(),
      getUri: () => testDatabase.uri,
      mongooseClient: testClient,
    });
    const connection = await manager.connect();
    const schema = createBaseSchema<SlugFixture>({
      name: { type: String, required: true },
      slug: createSlugField(),
    });
    const FixtureModel = connection.model<SlugFixture>("SlugUniquenessIntegrationFixture", schema);
    await FixtureModel.syncIndexes();
    await FixtureModel.create({ name: "Fesenjan one", slug: "fesenjan" });

    const resolution = await resolveUniqueSlug({
      canonicalText: "Fesenjan",
      isSlugTaken: async (slug) => Boolean(await FixtureModel.exists({ slug })),
    });
    expect(resolution.slug).toBe("fesenjan-2");
    await expect(
      FixtureModel.create({ name: "Fesenjan two", slug: resolution.slug }),
    ).resolves.toMatchObject({ slug: "fesenjan-2" });

    await expect(
      FixtureModel.create({ name: "Concurrent duplicate", slug: "fesenjan-2" }),
    ).rejects.toMatchObject({ code: 11_000 });

    await manager.disconnect();
  });
});
