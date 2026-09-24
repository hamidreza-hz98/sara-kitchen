import "server-only";

import { z } from "zod";

import { SUPPORTED_LOCALES } from "@/constants";
import { isStoredRichText } from "@/lib/rich-text";
import { SLUG_PATTERN } from "@/server/slugs";

import {
  BLOG_MAX_READ_TIME_MINUTES,
  BLOG_MAX_RELATIONS,
  BLOG_MAX_TAGS,
  BLOG_STATUSES,
} from "../model/blog";

const objectId = z.string().regex(/^[a-f\d]{24}$/iu);
const unique = <T extends z.ZodType>(value: T, max: number, min = 0) =>
  z
    .array(value)
    .min(min)
    .max(max)
    .refine((values) => new Set(values).size === values.length, "Values must be unique.");
const translation = z.strictObject({
  locale: z.enum(SUPPORTED_LOCALES),
  title: z.string().trim().min(1).max(180),
  excerpt: z.string().trim().min(1).max(500),
  content: z.unknown().refine(isStoredRichText, "Content does not satisfy the rich-text policy."),
});
export const blogCreateSchema = z.strictObject({
  translations: unique(translation, SUPPORTED_LOCALES.length, 1),
  slugOverride: z.string().trim().min(1).max(160).nullable().optional(),
  imageMediaId: objectId.nullable().optional(),
  bannerMediaId: objectId.nullable().optional(),
  readTimeMinutes: z.number().int().safe().min(1).max(BLOG_MAX_READ_TIME_MINUTES).optional(),
  tags: unique(z.string().regex(SLUG_PATTERN), BLOG_MAX_TAGS).optional(),
  relatedDishIds: unique(objectId, BLOG_MAX_RELATIONS).optional(),
  relatedBlogIds: unique(objectId, BLOG_MAX_RELATIONS).optional(),
});
export const blogUpdateSchema = blogCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0);
export const blogIdParametersSchema = z.strictObject({ blogId: objectId });
export const blogSlugParametersSchema = z.strictObject({
  blogSlug: z.string().regex(SLUG_PATTERN),
});
export const blogPublicListQuerySchema = z
  .strictObject({
    locale: z.enum(SUPPORTED_LOCALES).optional(),
    search: z.string().trim().min(2).max(80).optional(),
    sortBy: z.enum(["publishedAt", "viewCount"]).default("publishedAt"),
    sortDirection: z.enum(["asc", "desc"]).default("desc"),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(60).default(12),
  })
  .refine((value) => value.page * value.pageSize <= 10_000, "The requested page is too deep.");
export const blogDetailQuerySchema = z.strictObject({
  locale: z.enum(SUPPORTED_LOCALES).optional(),
});
export const blogPreviewQuerySchema = z.strictObject({
  token: z.string().min(40).max(512).optional(),
});
export const blogManagementListQuerySchema = z
  .strictObject({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(BLOG_STATUSES).optional(),
    authorAdminId: objectId.optional(),
    search: z.string().trim().min(2).max(80).optional(),
    sortBy: z
      .enum(["createdAt", "publishedAt", "publishAt", "status", "title", "viewCount"])
      .default("createdAt"),
    sortDirection: z.enum(["asc", "desc"]).default("desc"),
  })
  .refine((value) => value.page * value.pageSize <= 10_000, "The requested page is too deep.");
export const blogScheduleSchema = z.strictObject({ publishAt: z.coerce.date() });
export const blogEmptyMutationSchema = z.strictObject({});
export const blogViewSchema = z.strictObject({
  blogId: objectId,
  engagementMs: z.number().int().min(0).max(86_400_000),
  visibilityState: z.enum(["visible", "hidden"]),
});
