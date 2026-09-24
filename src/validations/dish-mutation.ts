import { z } from "zod";

import { SUPPORTED_LOCALES } from "@/constants";

export const DISH_FORM_AVAILABILITY_MODES = ["available", "unavailable", "scheduled"] as const;
export const DISH_FORM_DIETARY_TAGS = ["vegetarian", "vegan", "halal"] as const;
export const DISH_FORM_INGREDIENT_UNITS = [
  "gram",
  "millilitre",
  "piece",
  "teaspoon",
  "tablespoon",
] as const;
export const DISH_FORM_PORTION_UNITS = ["serving", "piece", "gram", "millilitre"] as const;
export const DISH_FORM_ALLERGEN_TAGS = [
  "celery",
  "crustaceans",
  "eggs",
  "fish",
  "gluten",
  "lupin",
  "milk",
  "molluscs",
  "mustard",
  "peanuts",
  "sesame",
  "soybeans",
  "sulphites",
  "tree_nuts",
] as const;

const objectId = z.string().regex(/^[a-f\d]{24}$/iu);
const uniqueArray = <Value extends z.ZodType>(value: Value, maximum: number) =>
  z
    .array(value)
    .max(maximum)
    .refine((values) => new Set(values).size === values.length, "Values must be unique.");
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
    quantityUnit: z.enum(DISH_FORM_INGREDIENT_UNITS).nullable().default(null),
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
  mode: z.enum(DISH_FORM_AVAILABILITY_MODES),
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
  portionUnit: z.enum(DISH_FORM_PORTION_UNITS).optional(),
  availability: availability.optional(),
  leadTimeMinutes: z.number().int().safe().min(0).max(10_080).optional(),
  maxQuantityPerOrder: z.number().int().min(1).max(99).optional(),
  mayContainAllergenTags: uniqueArray(
    z.enum(DISH_FORM_ALLERGEN_TAGS),
    DISH_FORM_ALLERGEN_TAGS.length,
  ).optional(),
  dietaryTags: uniqueArray(
    z.enum(DISH_FORM_DIETARY_TAGS),
    DISH_FORM_DIETARY_TAGS.length,
  ).optional(),
  isFeatured: z.boolean().optional(),
  featuredOrder: z.number().int().safe().nonnegative().optional(),
  relatedDishIds: uniqueArray(objectId, 30).optional(),
  relatedBlogIds: uniqueArray(objectId, 30).optional(),
  status: z.enum(["draft", "published"]).optional(),
} as const;

const dishCreateObjectSchema = z.strictObject(dishFields);

export const sharedDishCreateSchema = dishCreateObjectSchema.superRefine((value, context) => {
  const discount = value.discount;
  if (discount) {
    const start = discount.startsAt?.getTime() ?? null;
    const end = discount.endsAt?.getTime() ?? null;
    if (start !== null && end !== null && end <= start) {
      context.addIssue({
        code: "custom",
        message: "Discount end must be later than its start.",
        path: ["discount", "endsAt"],
      });
    }
    const invalidNone =
      discount.type === "none" &&
      (discount.amountCents !== null ||
        discount.basisPoints !== null ||
        discount.startsAt !== null ||
        discount.endsAt !== null);
    const invalidFixed =
      discount.type === "fixed" &&
      (discount.amountCents === null ||
        discount.amountCents < 1 ||
        discount.amountCents > value.basePriceCents ||
        discount.basisPoints !== null);
    const invalidPercentage =
      discount.type === "percentage" &&
      (discount.basisPoints === null ||
        discount.amountCents !== null ||
        value.basePriceCents === 0);
    if (invalidNone || invalidFixed || invalidPercentage) {
      context.addIssue({
        code: "custom",
        message: "Discount values do not match the selected discount type.",
        path: ["discount"],
      });
    }
  }

  if (value.availability) {
    const { mode, availableFrom, availableUntil } = value.availability;
    const start = availableFrom?.getTime() ?? null;
    const end = availableUntil?.getTime() ?? null;
    if (
      (mode === "scheduled" && start === null && end === null) ||
      (mode !== "scheduled" && (start !== null || end !== null)) ||
      (start !== null && end !== null && end <= start)
    ) {
      context.addIssue({
        code: "custom",
        message: "Availability boundaries do not match the selected mode.",
        path: ["availability"],
      });
    }
  }

  if (
    value.status === "published" &&
    (value.translations.length !== SUPPORTED_LOCALES.length ||
      !value.mediaIds?.length ||
      !value.categoryIds?.length ||
      !value.ingredients?.length)
  ) {
    context.addIssue({
      code: "custom",
      message: "Published dishes require every launch locale, media, category, and ingredient.",
      path: ["status"],
    });
  }
});
export const sharedDishUpdateSchema = z
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

export type SharedDishCreateInput = z.input<typeof sharedDishCreateSchema>;
