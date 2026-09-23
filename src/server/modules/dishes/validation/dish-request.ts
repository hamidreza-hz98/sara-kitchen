import "server-only";

import { z } from "zod";

import { SUPPORTED_LOCALES } from "@/constants";
import { INGREDIENT_ALLERGEN_TAGS } from "@/server/modules/ingredients";
import { SLUG_PATTERN } from "@/server/slugs";

import {
  DISH_AVAILABILITY_MODES,
  DISH_DIETARY_TAGS,
  DISH_INGREDIENT_QUANTITY_UNITS,
  DISH_MAX_LEAD_TIME_MINUTES,
  DISH_MAX_QUANTITY_PER_ORDER,
  DISH_PORTION_UNITS,
  DISH_STATUSES,
} from "../model/dish";
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
const optionalInstant = z.union([z.iso.datetime().transform((value) => new Date(value)), z.null()]);

const richText = z
  .strictObject({ type: z.literal("doc"), content: z.array(z.unknown()).optional() })
  .nullable()
  .optional()
  .refine((value) => value === undefined || JSON.stringify(value).length <= 100_000);
const translations = z
  .array(
    z.strictObject({
      locale: z.enum(SUPPORTED_LOCALES),
      name: z.string().trim().min(1).max(160),
      excerpt: z.string().trim().max(500).optional(),
      description: richText,
      specifications: z
        .array(
          z.strictObject({
            label: z.string().trim().min(1).max(80),
            value: z.string().trim().min(1).max(240),
          }),
        )
        .max(100)
        .default([]),
    }),
  )
  .min(1)
  .max(SUPPORTED_LOCALES.length)
  .refine((values) => new Set(values.map(({ locale }) => locale)).size === values.length)
  .refine((values) => values.some(({ locale, name }) => locale === "en" && name.length > 0));
const ingredient = z
  .strictObject({
    ingredientId: objectId,
    notes: z
      .array(
        z.strictObject({
          locale: z.enum(SUPPORTED_LOCALES),
          note: z.string().trim().min(1).max(240),
        }),
      )
      .max(SUPPORTED_LOCALES.length)
      .default([]),
    quantityAmount: z.number().finite().positive().max(1_000_000).nullable().default(null),
    quantityUnit: z.enum(DISH_INGREDIENT_QUANTITY_UNITS).nullable().default(null),
  })
  .refine((value) => (value.quantityAmount === null) === (value.quantityUnit === null));
const discount = z.strictObject({
  type: z.enum(["none", "fixed", "percentage"]),
  amountCents: z.number().int().safe().nonnegative().nullable().default(null),
  basisPoints: z.number().int().min(1).max(9_999).nullable().default(null),
  startsAt: optionalInstant.default(null),
  endsAt: optionalInstant.default(null),
});
const availability = z.strictObject({
  mode: z.enum(DISH_AVAILABILITY_MODES),
  availableFrom: optionalInstant.default(null),
  availableUntil: optionalInstant.default(null),
});

const dishFields = {
  translations,
  slugOverride: z.string().trim().min(1).max(160).nullable().optional(),
  mediaIds: uniqueArray(objectId, 30).optional(),
  categoryIds: uniqueArray(objectId, 20).optional(),
  ingredients: z.array(ingredient).max(200).optional(),
  basePriceCents: z.number().int().safe().nonnegative(),
  discount: discount.optional(),
  portionAmount: z.number().int().safe().positive().max(1_000_000).optional(),
  portionUnit: z.enum(DISH_PORTION_UNITS).optional(),
  availability: availability.optional(),
  leadTimeMinutes: z.number().int().safe().min(0).max(DISH_MAX_LEAD_TIME_MINUTES).optional(),
  maxQuantityPerOrder: z.number().int().min(1).max(DISH_MAX_QUANTITY_PER_ORDER).optional(),
  mayContainAllergenTags: uniqueArray(
    z.enum(INGREDIENT_ALLERGEN_TAGS),
    INGREDIENT_ALLERGEN_TAGS.length,
  ).optional(),
  dietaryTags: uniqueArray(z.enum(DISH_DIETARY_TAGS), DISH_DIETARY_TAGS.length).optional(),
  isFeatured: z.boolean().optional(),
  featuredOrder: z.number().int().safe().nonnegative().optional(),
  relatedDishIds: uniqueArray(objectId, 30).optional(),
  relatedBlogIds: uniqueArray(objectId, 30).optional(),
  status: z.enum(["draft", "published"]).optional(),
} as const;

export const dishCreateSchema = z.strictObject(dishFields);
export const dishUpdateSchema = z
  .strictObject({
    translations: translations.optional(),
    slugOverride: dishFields.slugOverride,
    mediaIds: dishFields.mediaIds,
    categoryIds: dishFields.categoryIds,
    ingredients: dishFields.ingredients,
    basePriceCents: dishFields.basePriceCents.optional(),
    discount: dishFields.discount,
    portionAmount: dishFields.portionAmount,
    portionUnit: dishFields.portionUnit,
    availability: dishFields.availability,
    leadTimeMinutes: dishFields.leadTimeMinutes,
    maxQuantityPerOrder: dishFields.maxQuantityPerOrder,
    mayContainAllergenTags: dishFields.mayContainAllergenTags,
    dietaryTags: dishFields.dietaryTags,
    isFeatured: dishFields.isFeatured,
    featuredOrder: dishFields.featuredOrder,
    relatedDishIds: dishFields.relatedDishIds,
    relatedBlogIds: dishFields.relatedBlogIds,
    status: dishFields.status,
  })
  .refine((value) => Object.keys(value).length > 0, "At least one dish field must be supplied.");

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
    search: z.string().trim().min(2).max(80).optional(),
    sortBy: z.enum(["name", "createdAt", "basePriceCents", "status"]).default("createdAt"),
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
