import "server-only";

import { z } from "zod";

import { SUPPORTED_LOCALES } from "@/constants";
import { validateTranslationValues } from "@/server/database/schema";

import type { CategoryTranslation } from "../model/category";

const objectId = z.string().regex(/^[a-f\d]{24}$/iu);
const translation = z.strictObject({
  locale: z.enum(SUPPORTED_LOCALES),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().min(1).max(20_000),
});

const translations = z
  .array(translation)
  .min(1)
  .max(SUPPORTED_LOCALES.length)
  .superRefine((values, context) => {
    const issues = validateTranslationValues<CategoryTranslation>(values, {
      canonicalTextFields: ["name", "description"],
    });
    for (const issue of issues) {
      context.addIssue({
        code: "custom",
        message: issue.message,
        path: issue.locale ? [issue.locale, issue.field ?? "locale"] : [],
      });
    }
  });

export const categoryIdParametersSchema = z.strictObject({ categoryId: objectId });

export const categoryListQuerySchema = z
  .strictObject({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(["draft", "published", "archived"]).optional(),
    search: z.string().trim().min(2).max(80).optional(),
    sortBy: z.enum(["sortOrder", "createdAt", "slug", "status"]).default("sortOrder"),
    sortDirection: z.enum(["asc", "desc"]).default("asc"),
  })
  .refine((value) => value.page * value.pageSize <= 10_000, {
    path: ["page"],
    message: "The requested page is too deep.",
  });

export const categoryCreateSchema = z.strictObject({
  translations,
  bannerMediaId: objectId.nullable().optional(),
  imageMediaId: objectId.nullable().optional(),
  slugOverride: z.string().trim().min(1).max(160).nullable().optional(),
  status: z.enum(["draft", "published"]).optional(),
  sortOrder: z.number().int().nonnegative().safe().optional(),
});

export const categoryUpdateSchema = categoryCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one category field must be supplied.",
  });

export const categoryArchiveSchema = z.strictObject({});
