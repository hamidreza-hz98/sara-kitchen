import "server-only";

import { z } from "zod";

import { SUPPORTED_LOCALES } from "@/constants";
import { INGREDIENT_ALLERGEN_TAGS } from "@/server/modules/ingredients";
import { SLUG_PATTERN } from "@/server/slugs";
import { sharedDishCreateSchema, sharedDishUpdateSchema } from "@/validations/dish-mutation";

import { DISH_AVAILABILITY_MODES, DISH_DIETARY_TAGS, DISH_STATUSES } from "../model/dish";
import {
  DISH_CATALOG_AVAILABILITY_FILTERS,
  DISH_CATALOG_SORTS,
  DISH_CATALOG_VIEW_MODES,
} from "../service/catalog-query";

const objectId = z.string().regex(/^[a-f\d]{24}$/iu);
const uniqueArray = <Value extends z.ZodType>(value: Value, maximum: number) =>
  z
    .array(value)
    .max(maximum)
    .refine((values) => new Set(values).size === values.length, "Values must be unique.");
const queryArray = <Value extends z.ZodType>(value: Value, maximum: number) =>
  z.preprocess(
    (input) => (typeof input === "string" ? [input] : (input ?? [])),
    uniqueArray(value, maximum),
  );
const queryBoolean = z.enum(["true", "false"]).transform((value) => value === "true");
export const dishCreateSchema = sharedDishCreateSchema;
export const dishUpdateSchema = sharedDishUpdateSchema;

export const dishIdParametersSchema = z.strictObject({ dishId: objectId });
export const dishSlugParametersSchema = z.strictObject({
  dishSlug: z.string().regex(SLUG_PATTERN),
});
export const dishEmptyMutationSchema = z.strictObject({});

export const dishManagementListQuerySchema = z
  .strictObject({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(DISH_STATUSES).optional(),
    categoryId: objectId.optional(),
    availability: z.enum(DISH_AVAILABILITY_MODES).optional(),
    featured: queryBoolean.optional(),
    search: z.string().trim().min(2).max(80).optional(),
    sortBy: z
      .enum([
        "name",
        "createdAt",
        "basePriceCents",
        "status",
        "soldCount",
        "viewCount",
        "featuredOrder",
      ])
      .default("createdAt"),
    sortDirection: z.enum(["asc", "desc"]).default("desc"),
  })
  .refine((value) => value.page * value.pageSize <= 10_000, "The requested page is too deep.");

export const dishCatalogQuerySchema = z
  .strictObject({
    locale: z.enum(SUPPORTED_LOCALES).optional(),
    fallbackLocale: z.enum(SUPPORTED_LOCALES).nullable().optional(),
    search: z.string().trim().min(2).max(80).optional(),
    categoryId: objectId.optional(),
    availability: z.enum(DISH_CATALOG_AVAILABILITY_FILTERS).optional(),
    featured: queryBoolean.optional(),
    discounted: queryBoolean.optional(),
    dietaryTags: queryArray(z.enum(DISH_DIETARY_TAGS), DISH_DIETARY_TAGS.length),
    excludeAllergens: queryArray(z.enum(INGREDIENT_ALLERGEN_TAGS), INGREDIENT_ALLERGEN_TAGS.length),
    sort: z.enum(DISH_CATALOG_SORTS).optional(),
    viewMode: z.enum(DISH_CATALOG_VIEW_MODES).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(60).default(12),
  })
  .refine((value) => value.page * value.pageSize <= 10_000, "The requested page is too deep.");

export const dishDetailQuerySchema = z.strictObject({
  locale: z.enum(SUPPORTED_LOCALES).optional(),
  fallbackLocale: z.enum(SUPPORTED_LOCALES).nullable().optional(),
});
