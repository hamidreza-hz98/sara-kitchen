import { Mongoose } from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createMongoConnectionCache,
  createMongoConnectionManager,
} from "@/server/database/connection-manager";
import {
  createBaseSchema,
  createTranslationsField,
  type BaseDocumentFields,
  type TranslationValue,
  type WithTranslations,
} from "@/server/database/schema";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

type PersistedTranslation = TranslationValue & {
  description?: string;
  name?: string;
};

type PersistedFixture = BaseDocumentFields &
  WithTranslations<PersistedTranslation> & {
    priceMinor: number;
  };

describe("persisted translation value conventions", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-translation-values-test");
    client = new Mongoose();
  }, 120_000);

  afterAll(async () => {
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  it("persists localized fields in id-less entries and shared values at the root", async () => {
    const testClient = client;
    const testDatabase = database;
    if (!testClient || !testDatabase) throw new Error("Test MongoDB did not start.");

    const manager = createMongoConnectionManager({
      cache: createMongoConnectionCache(),
      getUri: () => testDatabase.uri,
      mongooseClient: testClient,
    });
    const connection = await manager.connect();
    const schema = createBaseSchema<PersistedFixture>({
      priceMinor: { type: Number, required: true },
      translations: createTranslationsField<PersistedTranslation>(
        {
          description: { type: String, trim: true },
          name: { type: String, trim: true },
        },
        { canonicalTextFields: ["name"] },
      ),
    });
    const FixtureModel = connection.model<PersistedFixture>(
      "TranslationValuesIntegrationFixture",
      schema,
    );

    const fixture = await FixtureModel.create({
      priceMinor: 1400,
      translations: [
        { locale: "en", description: "Grilled meat and rice", name: "Koubideh Kebab" },
        { locale: "pt-PT", name: "Kebab Koubideh" },
        { locale: "fa", name: "کباب کوبیده" },
      ],
    });
    const stored = await FixtureModel.collection.findOne({ _id: fixture._id });

    expect(stored?.priceMinor).toBe(1400);
    expect(stored?.translations).toHaveLength(3);
    expect(stored?.translations[0]).toEqual({
      description: "Grilled meat and rice",
      locale: "en",
      name: "Koubideh Kebab",
    });
    expect(stored?.translations[0]).not.toHaveProperty("_id");
    expect(stored?.translations[0]).not.toHaveProperty("priceMinor");

    await expect(
      FixtureModel.create({
        priceMinor: 1400,
        translations: [
          { locale: "en", name: "Koubideh Kebab" },
          { locale: "en", name: "Duplicate" },
        ],
      }),
    ).rejects.toThrow(/only once/u);

    await manager.disconnect();
  });
});
