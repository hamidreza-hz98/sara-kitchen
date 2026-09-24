import "server-only";

import { z } from "zod";

import { SUPPORTED_LOCALES } from "@/constants";

import {
  SEO_IMAGE_PREVIEW_VALUES,
  SEO_MAX_KEYWORDS,
  SEO_OPEN_GRAPH_TYPES,
  SEO_STRUCTURED_DATA_TYPES,
  SEO_TWITTER_CARD_TYPES,
  isSafeCanonicalUrl,
  isSafeStructuredDataInputs,
} from "../model/page-seo";
import { STATIC_SEO_PAGE_KEYS } from "../policy/static-pages";

const unique = <T extends z.ZodType>(schema: T, maximum: number) =>
  z
    .array(schema)
    .max(maximum)
    .refine((values) => new Set(values).size === values.length, "Values must be unique.");

const socialTranslation = z.strictObject({
  title: z.string().trim().max(100).nullable().optional(),
  description: z.string().trim().max(220).nullable().optional(),
});

export const staticSeoTranslationSchema = z.strictObject({
  locale: z.enum(SUPPORTED_LOCALES),
  title: z.string().trim().min(1).max(70),
  description: z.string().trim().min(1).max(170),
  keywords: z
    .array(z.string().trim().min(1).max(60))
    .max(SEO_MAX_KEYWORDS)
    .refine(
      (values) =>
        new Set(values.map((value) => value.toLocaleLowerCase("en"))).size === values.length,
      "Keywords must be unique.",
    )
    .optional(),
  openGraph: socialTranslation.optional(),
  twitter: socialTranslation.optional(),
});

const robots = z.strictObject({
  index: z.boolean().optional(),
  follow: z.boolean().optional(),
  noArchive: z.boolean().optional(),
  noImageIndex: z.boolean().optional(),
  noSnippet: z.boolean().optional(),
  maxSnippet: z.number().int().min(-1).max(10_000).optional(),
  maxImagePreview: z.enum(SEO_IMAGE_PREVIEW_VALUES).optional(),
  maxVideoPreview: z.number().int().min(-1).max(86_400).optional(),
});

const openGraph = z.strictObject({
  type: z.enum(SEO_OPEN_GRAPH_TYPES).optional(),
  siteName: z.string().trim().max(100).nullable().optional(),
});

const twitterHandle = z
  .string()
  .regex(/^@[A-Za-z0-9_]{1,15}$/u)
  .nullable();
const twitter = z.strictObject({
  card: z.enum(SEO_TWITTER_CARD_TYPES).optional(),
  site: twitterHandle.optional(),
  creator: twitterHandle.optional(),
});

const structuredData = z.strictObject({
  types: unique(z.enum(SEO_STRUCTURED_DATA_TYPES), SEO_STRUCTURED_DATA_TYPES.length).optional(),
  inputs: z.unknown().refine(isSafeStructuredDataInputs).optional(),
});

const staticSeoBaseSchema = z.strictObject({
  key: z.enum(STATIC_SEO_PAGE_KEYS),
  translations: z.array(staticSeoTranslationSchema).min(1).max(SUPPORTED_LOCALES.length),
  canonicalUrl: z.string().trim().refine(isSafeCanonicalUrl).nullable().optional(),
  robots: robots.optional(),
  openGraph: openGraph.optional(),
  twitter: twitter.optional(),
  shareImageMediaId: z
    .string()
    .regex(/^[a-f\d]{24}$/iu)
    .nullable()
    .optional(),
  structuredData: structuredData.optional(),
  active: z.boolean().optional(),
});

function validateMetadata(
  value: Readonly<{
    translations?: readonly Readonly<{ locale: string }>[] | undefined;
    robots?:
      | Readonly<{
          noSnippet?: boolean | undefined;
          maxSnippet?: number | undefined;
        }>
      | undefined;
  }>,
  context: z.RefinementCtx,
): void {
  if (value.translations) {
    const locales = value.translations.map((entry) => entry.locale);
    if (new Set(locales).size !== locales.length) {
      context.addIssue({
        code: "custom",
        path: ["translations"],
        message: "Locales must be unique.",
      });
    }
    if (!locales.includes("en")) {
      context.addIssue({ code: "custom", path: ["translations"], message: "English is required." });
    }
  }
  if (
    value.robots?.noSnippet &&
    value.robots.maxSnippet !== undefined &&
    value.robots.maxSnippet !== -1
  ) {
    context.addIssue({
      code: "custom",
      path: ["robots", "maxSnippet"],
      message: "noSnippet cannot be combined with maxSnippet.",
    });
  }
}

export const staticSeoCreateSchema = staticSeoBaseSchema.superRefine((value, context) => {
  validateMetadata(value, context);
});

export const staticSeoUpdateSchema = staticSeoBaseSchema
  .omit({ key: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one field must be updated.")
  .superRefine((value, context) => validateMetadata(value, context));

export const staticSeoKeyParametersSchema = z.strictObject({
  staticPageKey: z.enum(STATIC_SEO_PAGE_KEYS),
});

export type StaticSeoCreateInput = z.input<typeof staticSeoCreateSchema>;
export type StaticSeoUpdateInput = z.input<typeof staticSeoUpdateSchema>;
