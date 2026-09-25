import { Mongoose, Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createSettingsSectionRepository,
  createSettingsServices,
  getSettingsSectionModel,
} from "@/server/modules/settings";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

const languagePayload = {
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
};

describe("settings application service", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-settings-service-test");
    client = new Mongoose();
    await client.connect(database.uri);
    await getSettingsSectionModel(client.connection).init();
  }, 120_000);

  afterAll(async () => {
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  it("persists direct and staged revisions with optimistic versioning", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const audit = vi.fn(async () => undefined);
    const invalidate = vi.fn();
    const repository = createSettingsSectionRepository(client.connection);
    const services = createSettingsServices({
      repository,
      cache: {
        read: <Value>(_key: string, _variant: string, load: () => Promise<Value>) => load(),
      },
      audit,
      invalidate,
      now: () => new Date("2026-09-25T13:00:00.000Z"),
    });
    const actor = { id: new Types.ObjectId().toHexString(), role: "owner" as const };

    const direct = await services.update(actor, "languages", languagePayload);
    expect(direct).toMatchObject({
      publicationPolicy: "direct",
      draft: null,
      published: { revision: 1 },
    });
    expect((await services.getPublic("languages"))?.defaultLocale).toBe("en");

    const faqPayload = {
      data: { entries: [] },
      translations: [
        {
          locale: "en",
          value: { title: "Frequently asked questions", description: "", entries: [] },
        },
      ],
    };
    const draft = await services.update(actor, "faq", faqPayload);
    expect(draft).toMatchObject({
      publicationPolicy: "staged",
      draft: { revision: 1 },
      published: null,
    });
    expect(await services.getPublic("faq")).toBeNull();

    const published = await services.publish(actor, "faq");
    expect(published).toMatchObject({ draft: null, published: { revision: 1 } });
    expect(await services.getPublic("faq")).toEqual({ requestedLocale: "en", entries: [] });
    expect(await getSettingsSectionModel(client.connection).countDocuments()).toBe(2);
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "publish", key: "faq", outcome: "success" }),
    );
    expect(invalidate).toHaveBeenCalledWith("sk:v1:settings:item:faq");
  });
});
