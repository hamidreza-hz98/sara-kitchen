import "server-only";

import { isValidObjectId, Schema } from "mongoose";
import type { Connection, Model, Types } from "mongoose";

import type { SupportedLocale } from "@/constants";
import {
  createBaseSchema,
  createTranslationsField,
  validateTranslationValues,
  type BaseDocumentFields,
  type SoftDeleteFields,
} from "@/server/database/schema";
import type { IngredientAllergenTag } from "@/server/modules/ingredients";
import { INGREDIENT_ALLERGEN_TAGS } from "@/server/modules/ingredients";
import {
  SLUG_PATTERN,
  SYSTEM_RESERVED_SLUGS,
  createSlugField,
  normalizeSlug,
} from "@/server/slugs";

export const DISH_STATUSES = ["draft", "published", "archived"] as const;
export const DISH_AVAILABILITY_MODES = ["available", "unavailable", "scheduled"] as const;
export const DISH_DISCOUNT_TYPES = ["none", "fixed", "percentage"] as const;
export const DISH_PORTION_UNITS = ["serving", "piece", "gram", "millilitre"] as const;
export const DISH_INGREDIENT_QUANTITY_UNITS = [
  "gram",
  "millilitre",
  "piece",
  "teaspoon",
  "tablespoon",
] as const;
export const DISH_DIETARY_TAGS = ["vegetarian", "vegan", "halal"] as const;
export const DISH_MAX_LEAD_TIME_MINUTES = 10_080;
export const DISH_DEFAULT_MAX_QUANTITY_PER_ORDER = 10;
export const DISH_MAX_QUANTITY_PER_ORDER = 99;

export type DishStatus = (typeof DISH_STATUSES)[number];
export type DishAvailabilityMode = (typeof DISH_AVAILABILITY_MODES)[number];
export type DishDiscountType = (typeof DISH_DISCOUNT_TYPES)[number];
export type DishPortionUnit = (typeof DISH_PORTION_UNITS)[number];
export type DishIngredientQuantityUnit = (typeof DISH_INGREDIENT_QUANTITY_UNITS)[number];
export type DishDietaryTag = (typeof DISH_DIETARY_TAGS)[number];

export type DishRichTextDocument = {
  content?: unknown[];
  type: "doc";
};

export type DishSpecification = {
  label: string;
  value: string;
};

export type DishTranslation = {
  description?: DishRichTextDocument | null;
  excerpt?: string;
  locale: SupportedLocale;
  name: string;
  specifications: DishSpecification[];
};

export type DishIngredientNote = {
  locale: SupportedLocale;
  note: string;
};

export type DishIngredientReference = {
  ingredientId: Types.ObjectId;
  notes: DishIngredientNote[];
  quantityAmount: number | null;
  quantityUnit: DishIngredientQuantityUnit | null;
};

export type DishDiscount = {
  amountCents: number | null;
  basisPoints: number | null;
  endsAt: Date | null;
  startsAt: Date | null;
  type: DishDiscountType;
};

export type DishAvailability = {
  availableFrom: Date | null;
  availableUntil: Date | null;
  mode: DishAvailabilityMode;
};

export type DishRecord = BaseDocumentFields &
  SoftDeleteFields & {
    availability: DishAvailability;
    basePriceCents: number;
    categoryIds: Types.ObjectId[];
    dietaryTags: DishDietaryTag[];
    discount: DishDiscount;
    featuredOrder: number;
    ingredients: DishIngredientReference[];
    isFeatured: boolean;
    leadTimeMinutes: number;
    maxQuantityPerOrder: number;
    mayContainAllergenTags: IngredientAllergenTag[];
    mediaIds: Types.ObjectId[];
    portionAmount: number;
    portionUnit: DishPortionUnit;
    relatedBlogIds: Types.ObjectId[];
    relatedDishIds: Types.ObjectId[];
    seoPageId: Types.ObjectId | null;
    slug: string;
    soldCount: number;
    status: DishStatus;
    translations: DishTranslation[];
    viewCount: number;
  };

const RESERVED_DISH_SLUGS = new Set<string>(SYSTEM_RESERVED_SLUGS);

const specificationSchema = new Schema<DishSpecification>(
  {
    label: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    value: { type: String, required: true, trim: true, minlength: 1, maxlength: 240 },
  },
  { _id: false, id: false },
);

const ingredientNoteSchema = new Schema<DishIngredientNote>(
  {
    locale: { type: String, enum: ["en", "pt-PT", "fa"], required: true, immutable: true },
    note: { type: String, required: true, trim: true, minlength: 1, maxlength: 240 },
  },
  { _id: false, id: false },
);

const ingredientReferenceSchema = new Schema<DishIngredientReference>(
  {
    ingredientId: {
      type: Schema.Types.ObjectId,
      ref: "Ingredient",
      required: true,
      validate: {
        validator: (value: Types.ObjectId) => isValidObjectId(value),
        message: "Dish ingredient must be a valid Ingredient ObjectId.",
      },
    },
    notes: {
      type: [ingredientNoteSchema],
      default: [],
      validate: {
        validator: (values: DishIngredientNote[]) =>
          values.length === 0 ||
          validateTranslationValues<DishIngredientNote>(values, {
            canonicalTextFields: ["note"],
          }).length === 0,
        message: "Ingredient notes require unique supported locales and canonical English text.",
      },
    },
    quantityAmount: {
      type: Number,
      default: null,
      validate: {
        validator: (value: number | null) =>
          value === null || (Number.isFinite(value) && value > 0 && value <= 1_000_000),
        message: "Ingredient quantity amount must be positive and finite.",
      },
    },
    quantityUnit: { type: String, enum: [...DISH_INGREDIENT_QUANTITY_UNITS, null], default: null },
  },
  { _id: false, id: false },
);

const discountSchema = new Schema<DishDiscount>(
  {
    amountCents: { type: Number, default: null },
    basisPoints: { type: Number, default: null },
    endsAt: { type: Date, default: null },
    startsAt: { type: Date, default: null },
    type: { type: String, enum: DISH_DISCOUNT_TYPES, required: true, default: "none" },
  },
  { _id: false, id: false },
);

const availabilitySchema = new Schema<DishAvailability>(
  {
    availableFrom: { type: Date, default: null },
    availableUntil: { type: Date, default: null },
    mode: { type: String, enum: DISH_AVAILABILITY_MODES, required: true, default: "available" },
  },
  { _id: false, id: false },
);

const uniqueObjectIds = (values: readonly Types.ObjectId[]) =>
  values.every((value) => isValidObjectId(value)) &&
  new Set(values.map((value) => value.toHexString())).size === values.length;

const objectIdArray = (ref: string) => ({
  type: [{ type: Schema.Types.ObjectId, ref }],
  default: [],
  validate: {
    validator: uniqueObjectIds,
    message: `${ref} references must contain unique valid ObjectIds.`,
  },
});

const optionalObjectId = (ref: string) => ({
  type: Schema.Types.ObjectId,
  ref,
  default: null,
  validate: {
    validator: (value: Types.ObjectId | null) => value === null || isValidObjectId(value),
    message: `Reference to ${ref} must be a valid ObjectId.`,
  },
});

const safeInteger = (minimum: number, maximum = Number.MAX_SAFE_INTEGER) => ({
  validator: (value: number) => Number.isSafeInteger(value) && value >= minimum && value <= maximum,
  message: `Value must be a safe integer from ${minimum} through ${maximum}.`,
});

function isRichTextDocument(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value !== "object" || Array.isArray(value)) return false;
  const document = value as Record<string, unknown>;
  return (
    document.type === "doc" &&
    (document.content === undefined || Array.isArray(document.content)) &&
    JSON.stringify(document).length <= 100_000
  );
}

export const dishSchema = createBaseSchema<DishRecord>(
  {
    translations: createTranslationsField<DishTranslation>(
      {
        name: { type: String, required: true, trim: true, minlength: 1, maxlength: 160 },
        excerpt: { type: String, trim: true, maxlength: 500, default: "" },
        description: {
          type: Schema.Types.Mixed,
          default: null,
          validate: {
            validator: isRichTextDocument,
            message: "Dish description must be a bounded rich-text document.",
          },
        },
        specifications: {
          type: [specificationSchema],
          default: [],
          validate: {
            validator: (values: DishSpecification[]) =>
              new Set(values.map((item) => item.label.trim().toLocaleLowerCase("en"))).size ===
              values.length,
            message: "Dish specification labels must be unique within each translation.",
          },
        },
      },
      { canonicalTextFields: ["name"] },
    ),
    slug: createSlugField(),
    mediaIds: objectIdArray("Media"),
    categoryIds: objectIdArray("Category"),
    ingredients: {
      type: [ingredientReferenceSchema],
      default: [],
      validate: {
        validator: (values: DishIngredientReference[]) =>
          new Set(values.map((item) => item.ingredientId.toHexString())).size === values.length,
        message: "Dish ingredient references must be unique.",
      },
    },
    basePriceCents: { type: Number, required: true, default: 0, validate: safeInteger(0) },
    discount: { type: discountSchema, required: true, default: () => ({ type: "none" }) },
    portionAmount: {
      type: Number,
      required: true,
      default: 1,
      validate: safeInteger(1, 1_000_000),
    },
    portionUnit: {
      type: String,
      enum: DISH_PORTION_UNITS,
      required: true,
      default: "serving",
    },
    availability: {
      type: availabilitySchema,
      required: true,
      default: () => ({ mode: "available" }),
    },
    leadTimeMinutes: {
      type: Number,
      required: true,
      default: 0,
      validate: safeInteger(0, DISH_MAX_LEAD_TIME_MINUTES),
    },
    maxQuantityPerOrder: {
      type: Number,
      required: true,
      default: DISH_DEFAULT_MAX_QUANTITY_PER_ORDER,
      validate: safeInteger(1, DISH_MAX_QUANTITY_PER_ORDER),
    },
    mayContainAllergenTags: {
      type: [{ type: String, enum: INGREDIENT_ALLERGEN_TAGS }],
      default: [],
      validate: {
        validator: (values: string[]) => new Set(values).size === values.length,
        message: "Dish may-contain allergen tags must be unique.",
      },
    },
    dietaryTags: {
      type: [{ type: String, enum: DISH_DIETARY_TAGS }],
      default: [],
      validate: {
        validator: (values: string[]) => new Set(values).size === values.length,
        message: "Dish dietary tags must be unique.",
      },
    },
    isFeatured: { type: Boolean, required: true, default: false },
    featuredOrder: { type: Number, required: true, default: 0, validate: safeInteger(0) },
    relatedDishIds: objectIdArray("Dish"),
    relatedBlogIds: objectIdArray("Blog"),
    seoPageId: optionalObjectId("SeoPage"),
    soldCount: { type: Number, required: true, default: 0, validate: safeInteger(0) },
    viewCount: { type: Number, required: true, default: 0, validate: safeInteger(0) },
    status: { type: String, enum: DISH_STATUSES, required: true, default: "draft" },
  },
  {
    collection: "dishes",
    schemaVersion: 1,
    softDelete: true,
    searchSourcePaths: ["translations"],
  },
);

dishSchema.pre("validate", function validateDishInvariants() {
  if (!this.slug) {
    const englishName = this.translations?.find((entry) => entry.locale === "en")?.name;
    if (englishName) {
      try {
        this.slug = normalizeSlug(englishName);
      } catch {
        this.invalidate("slug", "English dish name cannot produce a valid slug.");
      }
    }
  }
  if (this.slug && (!SLUG_PATTERN.test(this.slug) || RESERVED_DISH_SLUGS.has(this.slug))) {
    this.invalidate("slug", "Dish slug is invalid or reserved.");
  }

  for (const [index, ingredient] of this.ingredients.entries()) {
    const hasAmount = ingredient.quantityAmount !== null;
    const hasUnit = ingredient.quantityUnit !== null;
    if (hasAmount !== hasUnit) {
      this.invalidate(
        `ingredients.${index}.quantityAmount`,
        "Ingredient quantity amount and unit must be supplied together.",
      );
    }
  }

  if (this.discount.type === "none") {
    if (
      this.discount.amountCents !== null ||
      this.discount.basisPoints !== null ||
      this.discount.startsAt !== null ||
      this.discount.endsAt !== null
    ) {
      this.invalidate("discount", "A none discount cannot contain value or schedule fields.");
    }
  } else if (this.discount.type === "fixed") {
    if (
      !Number.isSafeInteger(this.discount.amountCents) ||
      (this.discount.amountCents ?? 0) <= 0 ||
      (this.discount.amountCents ?? 0) > this.basePriceCents ||
      this.discount.basisPoints !== null
    ) {
      this.invalidate(
        "discount.amountCents",
        "Fixed discount cents must be positive, not exceed base price, and exclude basis points.",
      );
    }
  } else if (
    !Number.isSafeInteger(this.discount.basisPoints) ||
    (this.discount.basisPoints ?? 0) <= 0 ||
    (this.discount.basisPoints ?? 0) > 10_000 ||
    this.discount.amountCents !== null
  ) {
    this.invalidate(
      "discount.basisPoints",
      "Percentage discount basis points must be from 1 through 10,000 and exclude cents.",
    );
  }
  if (
    this.discount.startsAt &&
    this.discount.endsAt &&
    this.discount.endsAt.getTime() <= this.discount.startsAt.getTime()
  ) {
    this.invalidate("discount.endsAt", "Discount end must be later than its start.");
  }

  if (this.availability.mode === "scheduled") {
    if (!this.availability.availableFrom && !this.availability.availableUntil) {
      this.invalidate("availability", "Scheduled availability requires at least one boundary.");
    }
  } else if (this.availability.availableFrom || this.availability.availableUntil) {
    this.invalidate("availability", "Only scheduled availability can contain boundaries.");
  }
  if (
    this.availability.availableFrom &&
    this.availability.availableUntil &&
    this.availability.availableUntil.getTime() <= this.availability.availableFrom.getTime()
  ) {
    this.invalidate(
      "availability.availableUntil",
      "Availability end must be later than its start.",
    );
  }

  if (this.dietaryTags.includes("vegan") && !this.dietaryTags.includes("vegetarian")) {
    this.dietaryTags.push("vegetarian");
  }
  if (this.relatedDishIds.some((id) => id.equals(this._id))) {
    this.invalidate("relatedDishIds", "A dish cannot relate to itself.");
  }
});

dishSchema.index(
  { deletedAt: 1, status: 1, "availability.mode": 1, createdAt: -1, _id: 1 },
  { name: "dish_public_catalog" },
);
dishSchema.index(
  { categoryIds: 1, deletedAt: 1, status: 1, createdAt: -1 },
  { name: "dish_category_catalog" },
);
dishSchema.index(
  { deletedAt: 1, status: 1, isFeatured: 1, featuredOrder: 1, _id: 1 },
  { name: "dish_featured_catalog" },
);
dishSchema.index(
  { deletedAt: 1, status: 1, basePriceCents: 1, _id: 1 },
  { name: "dish_price_catalog" },
);
dishSchema.index(
  { "availability.mode": 1, "availability.availableFrom": 1, "availability.availableUntil": 1 },
  { name: "dish_availability_schedule" },
);
dishSchema.index(
  { "discount.type": 1, "discount.startsAt": 1, "discount.endsAt": 1 },
  { name: "dish_discount_schedule" },
);
dishSchema.index(
  { "translations.name": "text", "translations.excerpt": "text" },
  {
    name: "dish_text_search",
    default_language: "none",
    weights: { "translations.name": 8, "translations.excerpt": 2 },
  },
);
dishSchema.index({ mediaIds: 1 }, { name: "dish_media_refs" });
dishSchema.index({ "ingredients.ingredientId": 1 }, { name: "dish_ingredient_refs" });
dishSchema.index({ relatedDishIds: 1 }, { name: "dish_related_dish_refs" });
dishSchema.index({ relatedBlogIds: 1 }, { name: "dish_related_blog_refs" });
dishSchema.index({ seoPageId: 1 }, { name: "dish_seo_ref", sparse: true });
dishSchema.index({ dietaryTags: 1, deletedAt: 1, status: 1 }, { name: "dish_dietary_catalog" });
dishSchema.index(
  { mayContainAllergenTags: 1, deletedAt: 1, status: 1 },
  { name: "dish_allergen_catalog" },
);

export function getDishModel(connection: Connection): Model<DishRecord> {
  return (
    (connection.models.Dish as Model<DishRecord> | undefined) ??
    connection.model<DishRecord>("Dish", dishSchema)
  );
}
