// @vitest-environment node

import { model, models } from "mongoose";
import { describe, expect, it } from "vitest";

import {
  CANONICAL_CONTENT_LOCALE,
  createBaseSchema,
  createTranslationsField,
  validateTranslationValues,
  type BaseDocumentFields,
  type TranslationValue,
  type WithTranslations,
} from "@/server/database/schema";

type FixtureTranslation = TranslationValue & {
  description?: string;
  name?: string;
};

type Fixture = BaseDocumentFields &
  WithTranslations<FixtureTranslation> & {
    isActive: boolean;
    priceMinor: number;
  };

const canonicalOptions = {
  canonicalTextFields: ["name"] as const,
};

function createFixtureModel(name: string) {
  const schema = createBaseSchema<Fixture>({
    isActive: { type: Boolean, default: true, required: true },
    priceMinor: { type: Number, min: 0, required: true },
    translations: createTranslationsField<FixtureTranslation>(
      {
        description: { type: String, trim: true },
        name: { type: String, trim: true },
      },
      canonicalOptions,
    ),
  });

  return models[name] ?? model<Fixture>(name, schema);
}

describe("translation value conventions", () => {
  it("uses English as the canonical locale and reports stable validation issues", () => {
    expect(CANONICAL_CONTENT_LOCALE).toBe("en");
    expect(
      validateTranslationValues<FixtureTranslation>(
        [
          { locale: "en", name: " " },
          { locale: "en", name: "Duplicate" },
        ],
        canonicalOptions,
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "duplicate_locale", locale: "en" }),
        expect.objectContaining({ code: "canonical_text_missing", field: "name", locale: "en" }),
      ]),
    );
  });

  it("accepts one canonical entry while other launch locales remain optional for drafts", async () => {
    const FixtureModel = createFixtureModel("TranslationValueValidUnitFixture");
    const fixture = new FixtureModel({
      isActive: true,
      priceMinor: 1250,
      translations: [{ locale: "en", description: "Home made", name: "Fesenjan" }],
    });

    await expect(fixture.validate()).resolves.toBeUndefined();
    expect(fixture.translations).toHaveLength(1);
    expect(fixture.priceMinor).toBe(1250);
    expect(fixture.translations[0]).not.toHaveProperty("priceMinor");
    expect(fixture.translations[0]).not.toHaveProperty("_id");
  });

  it("rejects duplicate locale entries", async () => {
    const FixtureModel = createFixtureModel("TranslationValueDuplicateUnitFixture");
    const fixture = new FixtureModel({
      isActive: true,
      priceMinor: 1250,
      translations: [
        { locale: "en", name: "Fesenjan" },
        { locale: "en", name: "Duplicate" },
      ],
    });

    await expect(fixture.validate()).rejects.toThrow(/only once/u);
  });

  it("rejects a missing English entry and blank canonical text", async () => {
    const FixtureModel = createFixtureModel("TranslationValueCanonicalUnitFixture");
    const missingCanonical = new FixtureModel({
      isActive: true,
      priceMinor: 1250,
      translations: [{ locale: "pt-PT", name: "Fesenjan" }],
    });
    await expect(missingCanonical.validate()).rejects.toThrow(/Canonical locale "en" is required/u);

    const blankCanonical = new FixtureModel({
      isActive: true,
      priceMinor: 1250,
      translations: [{ locale: "en", name: "   " }],
    });
    await expect(blankCanonical.validate()).rejects.toThrow(/Canonical en text is required/u);
  });

  it("rejects unsupported locales and invalid field configuration", async () => {
    const FixtureModel = createFixtureModel("TranslationValueLocaleUnitFixture");
    const fixture = new FixtureModel({
      isActive: true,
      priceMinor: 1250,
      translations: [{ locale: "de", name: "Fesenjan" }],
    });
    await expect(fixture.validate()).rejects.toThrow(/supported locales|not a valid enum/u);

    expect(() =>
      createTranslationsField<FixtureTranslation>({ name: String }, { canonicalTextFields: [] }),
    ).toThrow(/at least one/u);
    expect(() =>
      createTranslationsField<FixtureTranslation>(
        { name: String },
        { canonicalTextFields: ["description"] },
      ),
    ).toThrow(/not in the localized definition/u);
  });
});
