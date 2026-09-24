import { Mongoose, Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { findSeoMetadataByPath, getPageSeoModel } from "@/server/modules/seo";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

describe("SEO metadata read projection", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-seo-metadata-read-test");
    client = new Mongoose();
    await client.connect(database.uri);
  }, 120_000);

  afterAll(async () => {
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  it("returns active localized metadata without exposing management fields", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const PageSeo = getPageSeoModel(client.connection);
    const imageId = new Types.ObjectId();
    await PageSeo.create({
      targetType: "entity",
      entityKind: "dish",
      entityId: new Types.ObjectId(),
      path: "/menu/fesenjan",
      slug: "fesenjan",
      translations: [
        {
          locale: "en",
          title: "Fesenjan in Porto",
          description: "Order homemade Persian walnut stew.",
        },
      ],
      shareImageMediaId: imageId,
    });
    await PageSeo.create({
      targetType: "entity",
      entityKind: "dish",
      entityId: new Types.ObjectId(),
      path: "/menu/archived-dish",
      slug: "archived-dish",
      translations: [{ locale: "en", title: "Archived", description: "Not publicly available." }],
      active: false,
    });

    await expect(findSeoMetadataByPath(client.connection, "/menu/fesenjan")).resolves.toMatchObject(
      {
        path: "/menu/fesenjan",
        shareImageMediaId: imageId.toHexString(),
        translations: [{ locale: "en", title: "Fesenjan in Porto" }],
      },
    );
    await expect(
      findSeoMetadataByPath(client.connection, "/menu/archived-dish"),
    ).resolves.toBeNull();
  });
});
