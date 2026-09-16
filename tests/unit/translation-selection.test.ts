import { describe, expect, it } from "vitest";

import {
  buildLocaleResolutionOrder,
  resolveLocalizedValue,
  resolveTranslation,
} from "@/locales/translation-selection";

type DishTranslation = {
  description?: string;
  locale: "en" | "pt-PT" | "fa";
  name?: string;
  richContent?: { type: "document" };
};

const completeTranslations = [
  { locale: "en", name: "Koubideh Kebab", description: "Grilled meat and rice" },
  { locale: "pt-PT", name: "Kebab Koubideh", description: "Carne grelhada e arroz" },
  { locale: "fa", name: "کباب کوبیده", description: "گوشت کبابی و برنج" },
] as const satisfies readonly DishTranslation[];

describe("localized value selection", () => {
  it("selects the requested locale from complete translations", () => {
    expect(resolveTranslation(completeTranslations, "pt-PT")).toEqual({
      direction: "ltr",
      isFallback: false,
      requestedLocale: "pt-PT",
      resolvedLocale: "pt-PT",
      source: "requested",
      value: completeTranslations[1],
    });
    expect(resolveLocalizedValue(completeTranslations, "name", "en")?.value).toBe("Koubideh Kebab");
  });

  it("uses the configured fallback for a missing locale or partial field", () => {
    const partialTranslations: readonly DishTranslation[] = [
      { locale: "en", description: "Canonical description", name: "Canonical name" },
      { locale: "pt-PT", description: "Descrição portuguesa", name: "Nome português" },
      { locale: "fa", description: "   ", name: "نام فارسی" },
    ];

    expect(
      resolveLocalizedValue(partialTranslations, "description", "fa", {
        fallbackLocale: "pt-PT",
      }),
    ).toEqual({
      direction: "ltr",
      isFallback: true,
      requestedLocale: "fa",
      resolvedLocale: "pt-PT",
      source: "configured-fallback",
      value: "Descrição portuguesa",
    });
    expect(resolveTranslation(partialTranslations, "fa")?.value.name).toBe("نام فارسی");
  });

  it("uses canonical English after the configured fallback is unavailable", () => {
    const englishOnly: readonly DishTranslation[] = [{ locale: "en", name: "Canonical name" }];

    expect(
      resolveLocalizedValue(englishOnly, "name", "fa", { fallbackLocale: "pt-PT" }),
    ).toMatchObject({
      direction: "ltr",
      isFallback: true,
      requestedLocale: "fa",
      resolvedLocale: "en",
      source: "canonical",
      value: "Canonical name",
    });
  });

  it("returns null when translations or all candidate field values are missing", () => {
    expect(resolveTranslation([], "en")).toBeNull();
    expect(resolveTranslation(undefined, "fa", { fallbackLocale: "pt-PT" })).toBeNull();
    expect(
      resolveLocalizedValue(
        [{ locale: "en", name: " " }, { locale: "pt-PT" }] satisfies DishTranslation[],
        "name",
        "fa",
        { fallbackLocale: "pt-PT" },
      ),
    ).toBeNull();
  });

  it("preserves RTL metadata when Farsi satisfies the request", () => {
    expect(resolveLocalizedValue(completeTranslations, "name", "fa")).toEqual({
      direction: "rtl",
      isFallback: false,
      requestedLocale: "fa",
      resolvedLocale: "fa",
      source: "requested",
      value: "کباب کوبیده",
    });
  });

  it("deduplicates repeated fallback locales without changing precedence", () => {
    expect(buildLocaleResolutionOrder("fa", { fallbackLocale: "fa" })).toEqual([
      { locale: "fa", source: "requested" },
      { locale: "en", source: "canonical" },
    ]);
    expect(buildLocaleResolutionOrder("fa", { fallbackLocale: "en" })).toEqual([
      { locale: "fa", source: "requested" },
      { locale: "en", source: "configured-fallback" },
    ]);
    expect(buildLocaleResolutionOrder("en", { fallbackLocale: "pt-PT" })).toEqual([
      { locale: "en", source: "requested" },
      { locale: "pt-PT", source: "configured-fallback" },
    ]);
  });

  it("treats structured values, zero, and false as present", () => {
    type FlexibleTranslation = {
      count?: number;
      enabled?: boolean;
      locale: "en" | "pt-PT" | "fa";
      richContent?: { type: "document" };
    };
    const translations: FlexibleTranslation[] = [
      { locale: "en", count: 0, enabled: false, richContent: { type: "document" } },
    ];

    expect(resolveLocalizedValue(translations, "count", "en")?.value).toBe(0);
    expect(resolveLocalizedValue(translations, "enabled", "en")?.value).toBe(false);
    expect(resolveLocalizedValue(translations, "richContent", "en")?.value).toEqual({
      type: "document",
    });
  });
});
