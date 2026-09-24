import { Mongoose, Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  CONTACT_WEEKDAYS,
  getSettingsSectionModel,
  parseContactSettings,
} from "@/server/modules/settings";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

describe("contact settings storage", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-contact-settings-test");
    client = new Mongoose();
    await client.connect(database.uri);
  }, 120_000);

  afterAll(async () => {
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  it("persists contact settings as a direct published revision with no draft", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const parsed = parseContactSettings({
      data: {
        phones: [
          {
            id: "main-phone",
            kind: "mobile",
            number: "+351939086377",
            primary: true,
            public: true,
          },
        ],
        whatsapp: { enabled: true, number: "+351939086377" },
        email: "hello@sarakitchen.pt",
        address: { postalCode: "4000-008", countryCode: "PT" },
        location: { latitude: 41.1579, longitude: -8.6291 },
        serviceArea: { mode: "city", radiusKm: null },
        businessHours: CONTACT_WEEKDAYS.map((day) => ({ day, periods: [] })),
        timeZone: "Europe/Lisbon",
        map: null,
      },
      translations: [
        {
          locale: "en",
          value: {
            phoneLabels: [{ id: "main-phone", label: "Mobile" }],
            address: {
              line1: "Sara Kitchen",
              line2: "",
              city: "Porto",
              region: "Porto",
              country: "Portugal",
            },
            serviceArea: {
              name: "Porto city",
              description: "Delivery throughout Porto city.",
            },
            businessHoursNote: "Orders require 24 hours notice.",
            whatsappPrefilledMessage: "Hello Sara Kitchen",
            mapLabel: "Sara Kitchen location",
          },
        },
      ],
    });
    const publishedAt = new Date();
    const Settings = getSettingsSectionModel(client.connection);
    const saved = await Settings.create({
      key: "contact",
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
    expect(saved.published?.data).toMatchObject({
      email: "hello@sarakitchen.pt",
      location: { latitude: 41.1579, longitude: -8.6291 },
      timeZone: "Europe/Lisbon",
    });
  });
});
