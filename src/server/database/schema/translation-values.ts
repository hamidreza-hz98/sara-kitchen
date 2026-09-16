import { Schema } from "mongoose";
import type { SchemaDefinition, SchemaDefinitionProperty } from "mongoose";

import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  isSupportedLocale,
  type SupportedLocale,
} from "@/constants";

export const CANONICAL_CONTENT_LOCALE = DEFAULT_LOCALE;

export const TRANSLATION_VALIDATION_CODES = [
  "translations_required",
  "unsupported_locale",
  "duplicate_locale",
  "canonical_locale_missing",
  "canonical_text_missing",
] as const;

export type TranslationValidationCode = (typeof TRANSLATION_VALIDATION_CODES)[number];

export type TranslationValue = {
  locale: SupportedLocale;
};

export type WithTranslations<Translation extends TranslationValue> = {
  translations: Translation[];
};

export type TranslationTextField<Translation extends TranslationValue> = Extract<
  Exclude<keyof Translation, "locale">,
  string
>;

export type TranslationValueOptions<Translation extends TranslationValue> = {
  canonicalTextFields: readonly TranslationTextField<Translation>[];
};

export type TranslationValidationIssue = {
  code: TranslationValidationCode;
  field?: string;
  locale?: string;
  message: string;
};

type RuntimeTranslation = Record<string, unknown> & { locale?: unknown };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function hasCanonicalText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function validateOptions<Translation extends TranslationValue>(
  localizedDefinition: SchemaDefinition<Omit<Translation, "locale">>,
  options: TranslationValueOptions<Translation>,
): void {
  if (options.canonicalTextFields.length === 0) {
    throw new TypeError("canonicalTextFields must contain at least one localized text field.");
  }

  const fields = options.canonicalTextFields.map(String);
  if (new Set(fields).size !== fields.length || fields.some((field) => field.trim().length === 0)) {
    throw new TypeError("canonicalTextFields must contain unique, non-empty field names.");
  }

  const definitionFields = new Set(Object.keys(localizedDefinition));
  const unknownField = fields.find((field) => !definitionFields.has(field));
  if (unknownField) {
    throw new TypeError(
      `Canonical text field "${unknownField}" is not in the localized definition.`,
    );
  }
}

/**
 * Validate a complete translations array before a document save or atomic replacement.
 * The returned issues are stable service-layer codes and are also used by the Mongoose field.
 */
export function validateTranslationValues<Translation extends TranslationValue>(
  values: unknown,
  options: TranslationValueOptions<Translation>,
): TranslationValidationIssue[] {
  if (!Array.isArray(values) || values.length === 0) {
    return [
      {
        code: "translations_required",
        message: "At least one translation is required.",
      },
    ];
  }

  const issues: TranslationValidationIssue[] = [];
  const seenLocales = new Set<string>();
  let canonicalTranslation: RuntimeTranslation | undefined;

  for (const value of values) {
    const translation = isRecord(value) ? (value as RuntimeTranslation) : undefined;
    const locale = translation?.locale;

    if (typeof locale !== "string" || !isSupportedLocale(locale)) {
      issues.push({
        code: "unsupported_locale",
        ...(typeof locale === "string" ? { locale } : {}),
        message: `Translation locale must be one of: ${SUPPORTED_LOCALES.join(", ")}.`,
      });
      continue;
    }

    if (seenLocales.has(locale)) {
      issues.push({
        code: "duplicate_locale",
        locale,
        message: `Translation locale "${locale}" can appear only once.`,
      });
    }
    seenLocales.add(locale);

    if (locale === CANONICAL_CONTENT_LOCALE && !canonicalTranslation) {
      canonicalTranslation = translation;
    }
  }

  if (!canonicalTranslation) {
    issues.push({
      code: "canonical_locale_missing",
      locale: CANONICAL_CONTENT_LOCALE,
      message: `Canonical locale "${CANONICAL_CONTENT_LOCALE}" is required.`,
    });
    return issues;
  }

  for (const field of options.canonicalTextFields) {
    if (!hasCanonicalText(canonicalTranslation[field])) {
      issues.push({
        code: "canonical_text_missing",
        field,
        locale: CANONICAL_CONTENT_LOCALE,
        message: `Canonical ${CANONICAL_CONTENT_LOCALE} field "${field}" must contain text.`,
      });
    }
  }

  return issues;
}

function hasNoIssue(
  issues: readonly TranslationValidationIssue[],
  ...codes: readonly TranslationValidationCode[]
): boolean {
  return !issues.some((issue) => codes.includes(issue.code));
}

/**
 * Build the required `translations` field for an aggregate schema. Only linguistic fields belong
 * in `localizedDefinition`; prices, media, status, relations, counters, and audit data stay at the
 * aggregate root.
 */
export function createTranslationsField<Translation extends TranslationValue>(
  localizedDefinition: SchemaDefinition<Omit<Translation, "locale">>,
  options: TranslationValueOptions<Translation>,
): SchemaDefinitionProperty<Translation[]> {
  validateOptions(localizedDefinition, options);

  const runtimeDefinition = {
    locale: {
      type: String,
      enum: SUPPORTED_LOCALES,
      immutable: true,
      required: true,
    },
    ...localizedDefinition,
  } as unknown as SchemaDefinition<Translation>;

  const translationSchema = new Schema<Translation>(runtimeDefinition, {
    _id: false,
    id: false,
  });
  const inspect = (values: unknown) => validateTranslationValues(values, options);

  return {
    type: [translationSchema],
    default: undefined,
    required: [true, "At least one translation is required."],
    validate: [
      {
        validator: (values: unknown) =>
          hasNoIssue(inspect(values), "translations_required", "unsupported_locale"),
        message: `Translations must use supported locales: ${SUPPORTED_LOCALES.join(", ")}.`,
      },
      {
        validator: (values: unknown) => hasNoIssue(inspect(values), "duplicate_locale"),
        message: "Each translation locale can appear only once.",
      },
      {
        validator: (values: unknown) => hasNoIssue(inspect(values), "canonical_locale_missing"),
        message: `Canonical locale "${CANONICAL_CONTENT_LOCALE}" is required.`,
      },
      {
        validator: (values: unknown) => hasNoIssue(inspect(values), "canonical_text_missing"),
        message: `Canonical ${CANONICAL_CONTENT_LOCALE} text is required for: ${options.canonicalTextFields.join(", ")}.`,
      },
    ],
  } as unknown as SchemaDefinitionProperty<Translation[]>;
}
