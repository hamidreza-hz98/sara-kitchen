import { Mongoose, Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getSettingsSectionModel, parseHomepageSettings } from "@/server/modules/settings";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

describe("homepage settings storage", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-homepage-settings-test");
    client = new Mongoose();
    await client.connect(database.uri);
  }, 120_000);

  afterAll(async () => {
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  it("persists a parsed staged homepage revision without losing selection order", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const dishOne = new Types.ObjectId().toHexString();
    const dishTwo = new Types.ObjectId().toHexString();
    const parsed = parseHomepageSettings({
      data: {
        heroSlides: [],
        linkedBanners: [],
        featuredDishIds: [dishTwo, dishOne],
        benefits: [],
        testimonials: [],
        categoryBanners: [],
        discountedSection: { enabled: true, mode: "automatic", dishIds: [], limit: 6 },
        blogIds: [],
      },
      translations: [
        {
          locale: "en",
          value: {
            heroSlides: [],
            linkedBanners: [],
            benefits: [],
            testimonials: [],
            categoryBanners: [],
            sectionTitles: {
              featured: "Featured",
              benefits: "Benefits",
              testimonials: "Testimonials",
              categories: "Categories",
              discounted: "Offers",
              blog: "Blog",
            },
          },
        },
      ],
    });
    const Settings = getSettingsSectionModel(client.connection);
    const saved = await Settings.create({
      key: "homepage",
      publicationPolicy: "staged",
      draft: {
        revision: 1,
        data: parsed.data,
        translations: parsed.translations,
        editedByAdminId: new Types.ObjectId(),
        editedAt: new Date(),
        publishedAt: null,
      },
    });
    expect(saved.draft?.data.featuredDishIds).toEqual([dishTwo, dishOne]);
  });
});
