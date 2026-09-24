import { Mongoose, Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createStoredRichText } from "@/lib/rich-text";
import { getSettingsSectionModel, parseAboutSettings } from "@/server/modules/settings";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

describe("About settings storage", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-about-settings-test");
    client = new Mongoose();
    await client.connect(database.uri);
  }, 120_000);

  afterAll(async () => {
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  it("persists sanitized About content as a staged draft", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const content = createStoredRichText({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Our story" }] }],
    });
    const parsed = parseAboutSettings({
      data: {
        heroMediaId: null,
        kitchenMediaIds: [],
        teamMembers: [],
        values: [{ id: "hospitality", iconMediaId: null, enabled: true, order: 1 }],
        storySections: [],
        callsToAction: [],
      },
      translations: [
        {
          locale: "en",
          value: {
            eyebrow: "Our kitchen",
            title: "About Sara Kitchen",
            summary: "Homemade Persian food in Porto.",
            content,
            heroMediaAlt: "",
            kitchenMedia: [],
            teamMembers: [],
            values: [
              {
                id: "hospitality",
                title: "Hospitality",
                description: "Food made to be shared.",
              },
            ],
            storySections: [],
            callsToAction: [],
          },
        },
      ],
    });
    const Settings = getSettingsSectionModel(client.connection);
    const saved = await Settings.create({
      key: "about",
      publicationPolicy: "staged",
      draft: {
        revision: 1,
        data: parsed.data,
        translations: parsed.translations,
        editedByAdminId: new Types.ObjectId(),
        editedAt: new Date(),
        publishedAt: null,
      },
      published: null,
    });
    expect(saved.published).toBeNull();
    expect(saved.draft?.translations[0]?.value.content).toEqual(content);
    expect(saved.draft?.data.values).toEqual([
      expect.objectContaining({ id: "hospitality", order: 1 }),
    ]);
  });
});
