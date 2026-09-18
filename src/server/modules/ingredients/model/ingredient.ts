import "server-only";

import { isValidObjectId, Schema } from "mongoose";
import type { Connection, Model, Types } from "mongoose";

import type { SupportedLocale } from "@/constants";
import {
  createBaseSchema,
  createTranslationsField,
  normalizeSearchText,
  type BaseDocumentFields,
  type SoftDeleteFields,
} from "@/server/database/schema";

export const INGREDIENT_STATUSES = ["draft", "published", "archived"] as const;
export type IngredientStatus = (typeof INGREDIENT_STATUSES)[number];

/** Stable codes based on the 14 allergen groups declared for food in the EU. */
export const INGREDIENT_ALLERGEN_TAGS = [
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
export type IngredientAllergenTag = (typeof INGREDIENT_ALLERGEN_TAGS)[number];

export type IngredientTranslation = {
  locale: SupportedLocale;
  name: string;
};

export type IngredientRecord = BaseDocumentFields &
  SoftDeleteFields & {
    translations: IngredientTranslation[];
    canonicalNameKey: string;
    imageMediaId: Types.ObjectId | null;
    allergenTags: IngredientAllergenTag[];
    status: IngredientStatus;
  };

export const ingredientSchema = createBaseSchema<IngredientRecord>(
  {
    translations: createTranslationsField<IngredientTranslation>(
      { name: { type: String, required: true, trim: true, minlength: 1, maxlength: 160 } },
      { canonicalTextFields: ["name"] },
    ),
    canonicalNameKey: { type: String, required: true, select: false },
    imageMediaId: {
      type: Schema.Types.ObjectId,
      ref: "Media",
      default: null,
      validate: {
        validator: (value: Types.ObjectId | null) => value === null || isValidObjectId(value),
        message: "Ingredient image must be a valid Media ObjectId.",
      },
    },
    allergenTags: {
      type: [{ type: String, enum: INGREDIENT_ALLERGEN_TAGS }],
      default: [],
      validate: {
        validator: (values: string[]) => new Set(values).size === values.length,
        message: "Ingredient allergen tags must be unique.",
      },
    },
    status: { type: String, enum: INGREDIENT_STATUSES, required: true, default: "draft" },
  },
  {
    collection: "ingredients",
    schemaVersion: 1,
    softDelete: true,
    searchSourcePaths: ["translations", "allergenTags"],
  },
);

ingredientSchema.pre("validate", function setCanonicalNameKey() {
  const englishName = this.translations?.find((entry) => entry.locale === "en")?.name;
  if (!englishName) return;
  const normalized = normalizeSearchText(englishName);
  if (!normalized) {
    this.invalidate("translations", "English ingredient name must contain searchable text.");
    return;
  }
  this.canonicalNameKey = normalized;
});

ingredientSchema.index(
  { canonicalNameKey: 1, deletedAt: 1 },
  { unique: true, name: "ingredient_active_canonical_name_unique" },
);
ingredientSchema.index(
  { deletedAt: 1, status: 1, canonicalNameKey: 1, _id: 1 },
  { name: "ingredient_active_status_name" },
);
ingredientSchema.index(
  { "translations.name": "text" },
  { name: "ingredient_text_search", default_language: "none" },
);
ingredientSchema.index({ imageMediaId: 1 }, { name: "ingredient_image_media_ref" });
ingredientSchema.index({ allergenTags: 1, status: 1 }, { name: "ingredient_allergens_status" });

export function getIngredientModel(connection: Connection): Model<IngredientRecord> {
  return (
    (connection.models.Ingredient as Model<IngredientRecord> | undefined) ??
    connection.model<IngredientRecord>("Ingredient", ingredientSchema)
  );
}
