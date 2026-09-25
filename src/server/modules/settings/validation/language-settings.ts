import { z } from "zod";

import { SUPPORTED_LOCALES, type SupportedLocale } from "@/constants";

export const LANGUAGE_VISIBILITIES = ["active", "maintenance", "hidden"] as const;

export type LanguageVisibility = (typeof LANGUAGE_VISIBILITIES)[number];

const configuredLocaleSchema = z
  .object({
    locale: z.enum(SUPPORTED_LOCALES),
    visibility: z.enum(LANGUAGE_VISIBILITIES),
    order: z
      .number()
      .int()
      .min(0)
      .max(SUPPORTED_LOCALES.length - 1),
  })
  .strict();

const displayNameSchema = z
  .object({
    locale: z.enum(SUPPORTED_LOCALES),
    name: z.string().trim().min(1).max(80),
    shortName: z.string().trim().min(1).max(12),
  })
  .strict();

export const languageSettingsDataSchema = z
  .object({
    locales: z.array(configuredLocaleSchema).length(SUPPORTED_LOCALES.length),
    defaultLocale: z.enum(SUPPORTED_LOCALES),
    fallbackOrder: z.array(z.enum(SUPPORTED_LOCALES)).min(1).max(SUPPORTED_LOCALES.length),
  })
  .strict()
  .superRefine((data, context) => {
    const locales = data.locales.map(({ locale }) => locale);
    const orders = data.locales.map(({ order }) => order);
    const activeLocales = data.locales
      .filter(({ visibility }) => visibility === "active")
      .map(({ locale }) => locale);

    if (
      new Set(locales).size !== SUPPORTED_LOCALES.length ||
      SUPPORTED_LOCALES.some((locale) => !locales.includes(locale))
    ) {
      context.addIssue({
        code: "custom",
        message: "Every supported locale must appear exactly once.",
        path: ["locales"],
      });
    }
    if (new Set(orders).size !== orders.length) {
      context.addIssue({
        code: "custom",
        message: "Locale order values must be unique.",
        path: ["locales"],
      });
    }
    if (activeLocales.length === 0) {
      context.addIssue({
        code: "custom",
        message: "At least one locale must be active.",
        path: ["locales"],
      });
    }
    if (!activeLocales.includes(data.defaultLocale)) {
      context.addIssue({
        code: "custom",
        message: "The default locale must be active.",
        path: ["defaultLocale"],
      });
    }
    if (
      data.fallbackOrder.length !== activeLocales.length ||
      new Set(data.fallbackOrder).size !== data.fallbackOrder.length ||
      activeLocales.some((locale) => !data.fallbackOrder.includes(locale))
    ) {
      context.addIssue({
        code: "custom",
        message: "Fallback order must contain every active locale exactly once.",
        path: ["fallbackOrder"],
      });
    }
  });

export const languageSettingsTranslationValueSchema = z
  .object({ displayNames: z.array(displayNameSchema).max(SUPPORTED_LOCALES.length) })
  .strict();

const translationSchema = z
  .object({
    locale: z.enum(SUPPORTED_LOCALES),
    value: languageSettingsTranslationValueSchema,
  })
  .strict();

export const languageSettingsPayloadSchema = z
  .object({
    data: languageSettingsDataSchema,
    translations: z.array(translationSchema).min(1).max(SUPPORTED_LOCALES.length),
  })
  .strict()
  .superRefine((payload, context) => {
    const translationLocales = payload.translations.map(({ locale }) => locale);
    if (new Set(translationLocales).size !== translationLocales.length) {
      context.addIssue({
        code: "custom",
        message: "Translation locales must be unique.",
        path: ["translations"],
      });
    }
    if (!translationLocales.includes("en")) {
      context.addIssue({
        code: "custom",
        message: "Canonical English display names are required.",
        path: ["translations"],
      });
    }

    for (const [index, translation] of payload.translations.entries()) {
      const names = translation.value.displayNames.map(({ locale }) => locale);
      if (new Set(names).size !== names.length) {
        context.addIssue({
          code: "custom",
          message: "Display-name locales must be unique.",
          path: ["translations", index, "value", "displayNames"],
        });
      }
      if (
        translation.locale === "en" &&
        (names.length !== SUPPORTED_LOCALES.length ||
          SUPPORTED_LOCALES.some((locale) => !names.includes(locale)))
      ) {
        context.addIssue({
          code: "custom",
          message: "Canonical English must name every supported locale.",
          path: ["translations", index, "value", "displayNames"],
        });
      }
    }
  });

export type LanguageSettingsData = z.infer<typeof languageSettingsDataSchema>;
export type LanguageSettingsPayload = z.infer<typeof languageSettingsPayloadSchema>;
export type LanguageSettingsTranslationValue = z.infer<
  typeof languageSettingsTranslationValueSchema
>;
export type LanguageSettingsTranslation = Readonly<{
  locale: SupportedLocale;
  value: LanguageSettingsTranslationValue;
}>;

export function parseLanguageSettings(value: unknown): LanguageSettingsPayload {
  return languageSettingsPayloadSchema.parse(value);
}
