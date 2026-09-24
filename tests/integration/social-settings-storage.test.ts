import { Mongoose, Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getSettingsSectionModel, parseSocialSettings } from "@/server/modules/settings";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

describe("social settings storage", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-social-settings-test");
    client = new Mongoose();
    await client.connect(database.uri);
  }, 120_000);

  afterAll(async () => {
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  it("persists social settings as one direct published revision", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const parsed = parseSocialSettings({
      data: {
        links: [
          {
            id: "instagram-main",
            platform: "instagram",
            destination: { type: "handle", handle: "sara_kitchenpt" },
            iconKey: "instagram",
            active: true,
            order: 1,
          },
        ],
      },
      translations: [
        {
          locale: "en",
          value: {
            labels: [{ id: "instagram-main", label: "Sara Kitchen on Instagram" }],
          },
        },
      ],
    });
    const publishedAt = new Date();
    const Settings = getSettingsSectionModel(client.connection);
    const saved = await Settings.create({
      key: "social",
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
    expect(saved.published?.data.links).toEqual([
      expect.objectContaining({ platform: "instagram", iconKey: "instagram", order: 1 }),
    ]);
  });
});
