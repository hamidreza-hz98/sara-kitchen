import { Mongoose, Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getSettingsSectionModel, parseFaqSettings } from "@/server/modules/settings";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

describe("FAQ settings storage", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-faq-settings-test");
    client = new Mongoose();
    await client.connect(database.uri);
  }, 120_000);

  afterAll(async () => {
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  it("persists ordered FAQ content as a staged draft", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const parsed = parseFaqSettings({
      data: {
        entries: [
          { id: "delivery-area", active: true, order: 0 },
          { id: "order-ahead", active: true, order: 1 },
        ],
      },
      translations: [
        {
          locale: "en",
          value: {
            title: "Frequently asked questions",
            description: "Ordering and delivery answers.",
            entries: [
              {
                id: "delivery-area",
                question: "Where do you deliver?",
                answer: "Throughout Porto.",
              },
              {
                id: "order-ahead",
                question: "How early should I order?",
                answer: "At least 24 hours in advance.",
              },
            ],
          },
        },
      ],
    });
    const Settings = getSettingsSectionModel(client.connection);
    const saved = await Settings.create({
      key: "faq",
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
    expect(saved.draft?.data.entries).toEqual([
      expect.objectContaining({ id: "delivery-area", order: 0 }),
      expect.objectContaining({ id: "order-ahead", order: 1 }),
    ]);
    expect(saved.draft?.translations[0]?.value.entries).toHaveLength(2);
  });
});
