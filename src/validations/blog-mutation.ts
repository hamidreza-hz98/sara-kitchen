import { z } from "zod";

import { SUPPORTED_LOCALES } from "@/constants";

export const BLOG_FORM_MAX_READ_TIME_MINUTES = 1_440;
export const BLOG_FORM_MAX_RELATIONS = 30;
export const BLOG_FORM_MAX_TAGS = 20;

const objectId = z.string().regex(/^[a-f\d]{24}$/iu);
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
const unique = <Value extends z.ZodType>(value: Value, maximum: number, minimum = 0) =>
  z
    .array(value)
    .min(minimum)
    .max(maximum)
    .refine((values) => new Set(values).size === values.length, "Values must be unique.");

const translation = z.strictObject({
  locale: z.enum(SUPPORTED_LOCALES),
  title: z.string().trim().min(1).max(180),
  excerpt: z.string().trim().min(1).max(500),
  content: z
    .strictObject({
      schemaVersion: z.literal(1),
      document: z.strictObject({
        type: z.literal("doc"),
        content: z.array(z.unknown()).optional(),
      }),
    })
    .refine(
      (value) => JSON.stringify(value).length <= 500_000,
      "Content does not satisfy the rich-text policy.",
    ),
});

export const sharedBlogCreateSchema = z.strictObject({
  translations: z
    .array(translation)
    .min(1)
    .max(SUPPORTED_LOCALES.length)
    .refine(
      (values) => new Set(values.map(({ locale }) => locale)).size === values.length,
      "Locales must be unique.",
    ),
  slugOverride: z.string().trim().min(1).max(160).nullable().optional(),
  imageMediaId: objectId.nullable().optional(),
  bannerMediaId: objectId.nullable().optional(),
  readTimeMinutes: z.number().int().safe().min(1).max(BLOG_FORM_MAX_READ_TIME_MINUTES).optional(),
  tags: unique(slug, BLOG_FORM_MAX_TAGS).optional(),
  relatedDishIds: unique(objectId, BLOG_FORM_MAX_RELATIONS).optional(),
  relatedBlogIds: unique(objectId, BLOG_FORM_MAX_RELATIONS).optional(),
});

export const sharedBlogUpdateSchema = sharedBlogCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0);
