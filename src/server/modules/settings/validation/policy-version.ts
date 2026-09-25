import { z } from "zod";

import { SUPPORTED_LOCALES, type SupportedLocale } from "@/constants";
import { isStoredRichText, type StoredRichText } from "@/lib/rich-text";

export const POLICY_DOCUMENT_TYPES = [
  "terms-of-service",
  "privacy-policy",
  "marketing-consent",
  "delivery-policy",
  "refund-policy",
] as const;
export const POLICY_PUBLICATION_STATES = ["draft", "scheduled", "published", "retired"] as const;
export const POLICY_MAX_SECTIONS = 40;

export type PolicyDocumentType = (typeof POLICY_DOCUMENT_TYPES)[number];
export type PolicyPublicationState = (typeof POLICY_PUBLICATION_STATES)[number];

const sectionIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u, "Use a stable lowercase kebab-case identifier.");
const storedRichTextSchema = z.custom<StoredRichText>(isStoredRichText, {
  message: "Policy content must satisfy the versioned rich-text policy.",
});

const policySectionTranslationSchema = z
  .object({
    id: sectionIdSchema,
    title: z.string().trim().min(1).max(200),
    content: storedRichTextSchema,
  })
  .strict();

export const policyVersionTranslationSchema = z
  .object({
    locale: z.enum(SUPPORTED_LOCALES),
    title: z.string().trim().min(1).max(200),
    summary: z.string().trim().max(1_000).default(""),
    sections: z.array(policySectionTranslationSchema).max(POLICY_MAX_SECTIONS),
  })
  .strict();

export const policyVersionContentSchema = z
  .object({
    documentType: z.enum(POLICY_DOCUMENT_TYPES),
    version: z.number().int().positive().max(1_000_000),
    effectiveAt: z.coerce.date(),
    sectionIds: z.array(sectionIdSchema).min(1).max(POLICY_MAX_SECTIONS),
    translations: z.array(policyVersionTranslationSchema).min(1).max(SUPPORTED_LOCALES.length),
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.sectionIds).size !== value.sectionIds.length) {
      context.addIssue({
        code: "custom",
        message: "Policy section IDs must be unique.",
        path: ["sectionIds"],
      });
    }
    const locales = value.translations.map(({ locale }) => locale);
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
        message: "Canonical English policy content is required.",
        path: ["translations"],
      });
    }
    const configured = new Set(value.sectionIds);
    for (const [index, translation] of value.translations.entries()) {
      const ids = translation.sections.map(({ id }) => id);
      if (ids.length !== new Set(ids).size || ids.some((id) => !configured.has(id))) {
        context.addIssue({
          code: "custom",
          message: "Translated sections must be unique and reference configured section IDs.",
          path: ["translations", index, "sections"],
        });
      }
      if (translation.locale === "en" && ids.length !== value.sectionIds.length) {
        context.addIssue({
          code: "custom",
          message: "Canonical English must contain every configured policy section.",
          path: ["translations", index, "sections"],
        });
      }
    }
  });

export type PolicySectionTranslation = z.infer<typeof policySectionTranslationSchema>;
export type PolicyVersionTranslation = z.infer<typeof policyVersionTranslationSchema>;
export type PolicyVersionContent = z.infer<typeof policyVersionContentSchema>;
export type PolicyLocalizedTranslation = Readonly<{
  locale: SupportedLocale;
  title: string;
  summary: string;
  sections: readonly PolicySectionTranslation[];
}>;

export function parsePolicyVersionContent(value: unknown): PolicyVersionContent {
  return policyVersionContentSchema.parse(value);
}
