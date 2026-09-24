import { Mongoose, Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getPageSeoModel } from "@/server/modules/seo";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

describe("Page SEO persistence", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-page-seo-model-test");
    client = new Mongoose();
    await client.connect(database.uri);
  }, 120_000);

  afterAll(async () => {
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  it("enforces one active record per locale-aware target and normalized path", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const PageSeo = getPageSeoModel(client.connection);
    await PageSeo.init();

    const entityId = new Types.ObjectId();
    const makeRecord = (overrides: Record<string, unknown> = {}) => ({
      targetType: "entity",
      entityKind: "dish",
      entityId,
      path: "/menu/fesenjan",
      slug: "fesenjan",
      translations: [
        {
          locale: "en",
          title: "Order Fesenjan in Porto",
          description: "Homemade Persian walnut stew delivered in Porto.",
        },
      ],
      ...overrides,
    });

    await new PageSeo(makeRecord()).save();
    await expect(new PageSeo(makeRecord()).save()).rejects.toMatchObject({ code: 11000 });
    await expect(
      new PageSeo(
        makeRecord({ entityId: new Types.ObjectId(), path: "/menu/fesenjan", slug: "fesenjan" }),
      ).save(),
    ).rejects.toMatchObject({ code: 11000 });

    await expect(new PageSeo(makeRecord({ active: false })).save()).resolves.toBeDefined();
    await expect(
      new PageSeo(
        makeRecord({
          entityId: new Types.ObjectId(),
          path: "/blog/fesenjan",
          slug: "fesenjan",
        }),
      ).save(),
    ).resolves.toBeDefined();
  });
});
