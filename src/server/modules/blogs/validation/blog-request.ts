import "server-only";

import { z } from "zod";

import { SUPPORTED_LOCALES } from "@/constants";
import { SLUG_PATTERN } from "@/server/slugs";
import { sharedBlogCreateSchema, sharedBlogUpdateSchema } from "@/validations/blog-mutation";

import { BLOG_STATUSES } from "../model/blog";

const objectId = z.string().regex(/^[a-f\d]{24}$/iu);
export const blogCreateSchema = sharedBlogCreateSchema;
export const blogUpdateSchema = sharedBlogUpdateSchema;
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
