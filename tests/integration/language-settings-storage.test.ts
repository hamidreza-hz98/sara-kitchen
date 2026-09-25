import { Mongoose, Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getSettingsSectionModel, parseLanguageSettings } from "@/server/modules/settings";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

describe("language settings storage", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-language-settings-test");
    client = new Mongoose();
    await client.connect(database.uri);
  }, 120_000);

  afterAll(async () => {
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  it("persists all locales as one direct revision while retaining unavailable locale metadata", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const parsed = parseLanguageSettings({
      data: {
        locales: [
          { locale: "en", visibility: "active", order: 0 },
          { locale: "pt-PT", visibility: "active", order: 1 },
          { locale: "fa", visibility: "hidden", order: 2 },
        ],
        defaultLocale: "en",
        fallbackOrder: ["en", "pt-PT"],
      },
      translations: [
        {
          locale: "en",
          value: {
            displayNames: [
              { locale: "en", name: "English", shortName: "EN" },
              { locale: "pt-PT", name: "Portuguese", shortName: "PT" },
              { locale: "fa", name: "Persian", shortName: "FA" },
            ],
          },
        },
      ],
    });
    const publishedAt = new Date();
    const Settings = getSettingsSectionModel(client.connection);
    const saved = await Settings.create({
      key: "languages",
      publicationPolicy: "direct",
      draft: null,
      published: {
        revision: 1,
        data: parsed.data,
        translations: parsed.translations,
        editedByAdminId: new Types.ObjectId(),
        editedAt: publishedAt,
        publishedAt,
      },
    });

    expect(saved.draft).toBeNull();
    expect(saved.published?.data.locales).toHaveLength(3);
    expect(saved.published?.data.locales).toContainEqual(
      expect.objectContaining({ locale: "fa", visibility: "hidden" }),
    );
    expect(saved.published?.data.defaultLocale).toBe("en");
  });
});
