import { z } from "zod";

import { SUPPORTED_LOCALES, type SupportedLocale } from "@/constants";

export const FAQ_MAX_ENTRIES = 100;

const itemIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u, "Use a stable lowercase kebab-case identifier.");
const localizedText = (maximum: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(maximum)
    .refine((value) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value), {
      message: "Text contains unsupported control characters.",
    });

const faqEntrySchema = z
  .object({
    id: itemIdSchema,
    active: z.boolean(),
    order: z.number().int().min(0).max(9_999),
  })
  .strict();

export const faqSettingsDataSchema = z
  .object({ entries: z.array(faqEntrySchema).max(FAQ_MAX_ENTRIES) })
  .strict()
  .superRefine(({ entries }, context) => {
    const ids = entries.map(({ id }) => id);
    const orders = entries.map(({ order }) => order);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: "custom", message: "FAQ IDs must be unique.", path: ["entries"] });
    }
    if (new Set(orders).size !== orders.length) {
      context.addIssue({
        code: "custom",
        message: "FAQ order values must be unique.",
        path: ["entries"],
      });
    }
  });

const localizedEntrySchema = z
  .object({
    id: itemIdSchema,
    question: localizedText(240),
    answer: localizedText(2_000),
  })
  .strict();

export const faqSettingsTranslationValueSchema = z
  .object({
    title: localizedText(160),
    description: z.string().trim().max(800).default(""),
    entries: z.array(localizedEntrySchema).max(FAQ_MAX_ENTRIES),
  })
  .strict();

const translationSchema = z
  .object({ locale: z.enum(SUPPORTED_LOCALES), value: faqSettingsTranslationValueSchema })
  .strict();

export const faqSettingsPayloadSchema = z
  .object({
    data: faqSettingsDataSchema,
    translations: z.array(translationSchema).min(1).max(SUPPORTED_LOCALES.length),
  })
  .strict()
  .superRefine((payload, context) => {
    const locales = payload.translations.map(({ locale }) => locale);
    if (new Set(locales).size !== locales.length) {
      context.addIssue({
        code: "custom",
        message: "Locales must be unique.",
        path: ["translations"],
      });
    }
    if (!locales.includes("en")) {
      context.addIssue({
        code: "custom",
        message: "Canonical English FAQ content is required.",
        path: ["translations"],
      });
    }
    const configuredIds = new Set(payload.data.entries.map(({ id }) => id));
    for (const [translationIndex, translation] of payload.translations.entries()) {
      const ids = translation.value.entries.map(({ id }) => id);
      if (ids.length !== new Set(ids).size || ids.some((id) => !configuredIds.has(id))) {
        context.addIssue({
          code: "custom",
          message: "Localized FAQ entries must be unique and reference configured IDs.",
          path: ["translations", translationIndex, "value", "entries"],
        });
      }
      if (translation.locale === "en" && ids.length !== configuredIds.size) {
        context.addIssue({
          code: "custom",
          message: "Canonical English must translate every configured FAQ entry.",
          path: ["translations", translationIndex, "value", "entries"],
        });
      }
    }
  });

export type FaqSettingsData = z.infer<typeof faqSettingsDataSchema>;
export type FaqSettingsTranslationValue = z.infer<typeof faqSettingsTranslationValueSchema>;
export type FaqSettingsPayload = z.infer<typeof faqSettingsPayloadSchema>;
export type FaqSettingsTranslation = Readonly<{
  locale: SupportedLocale;
  value: FaqSettingsTranslationValue;
}>;

export function parseFaqSettings(value: unknown): FaqSettingsPayload {
  return faqSettingsPayloadSchema.parse(value);
}
