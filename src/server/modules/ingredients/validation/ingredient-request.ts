import "server-only";

import { z } from "zod";

import { SUPPORTED_LOCALES } from "@/constants";

import { INGREDIENT_ALLERGEN_TAGS, INGREDIENT_STATUSES } from "../model/ingredient";

const objectId = z.string().regex(/^[a-f\d]{24}$/iu);
const translation = z.strictObject({
  locale: z.enum(SUPPORTED_LOCALES),
  name: z.string().trim().min(1).max(160),
});
const translations = z
  .array(translation)
  .min(1)
  .max(SUPPORTED_LOCALES.length)
  .refine((values) => new Set(values.map((value) => value.locale)).size === values.length, {
    message: "Each locale can appear only once.",
  })
  .refine((values) => values.some((value) => value.locale === "en" && value.name.length > 0), {
    message: "English ingredient name is required.",
  });

export const ingredientIdParametersSchema = z.strictObject({ ingredientId: objectId });
const ingredientFields = {
  translations,
  imageMediaId: objectId.nullable().optional(),
  allergenTags: z
    .array(z.enum(INGREDIENT_ALLERGEN_TAGS))
    .max(INGREDIENT_ALLERGEN_TAGS.length)
    .refine((values) => new Set(values).size === values.length, {
      message: "Allergen tags must be unique.",
    })
    .optional(),
  status: z.enum(["draft", "published"]).optional(),
} as const;
export const ingredientCreateSchema = z.strictObject(ingredientFields);
export const ingredientUpdateSchema = z
  .strictObject({
    translations: translations.optional(),
    imageMediaId: objectId.nullable().optional(),
    allergenTags: ingredientFields.allergenTags,
    status: ingredientFields.status,
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one ingredient field must be supplied.",
  });
export const ingredientListQuerySchema = z
  .strictObject({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(INGREDIENT_STATUSES).optional(),
    allergen: z.enum(INGREDIENT_ALLERGEN_TAGS).optional(),
    search: z.string().trim().min(2).max(80).optional(),
    sortBy: z.enum(["name", "createdAt", "status"]).default("name"),
    sortDirection: z.enum(["asc", "desc"]).default("asc"),
  })
  .refine((value) => value.page * value.pageSize <= 10_000, {
    path: ["page"],
    message: "The requested page is too deep.",
  });
export const ingredientEmptyMutationSchema = z.strictObject({});
