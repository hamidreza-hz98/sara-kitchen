import "server-only";

import { isValidObjectId, Schema } from "mongoose";
import type { Connection, Model, Types } from "mongoose";

import type { SupportedLocale } from "@/constants";
import {
  createBaseSchema,
  createTranslationsField,
  type BaseDocumentFields,
  type SoftDeleteFields,
} from "@/server/database/schema";
import {
  SLUG_PATTERN,
  SYSTEM_RESERVED_SLUGS,
  createSlugField,
  normalizeSlug,
} from "@/server/slugs";

export const CATEGORY_STATUSES = ["draft", "published", "archived"] as const;
export type CategoryStatus = (typeof CATEGORY_STATUSES)[number];
const RESERVED_CATEGORY_SLUGS = new Set<string>(SYSTEM_RESERVED_SLUGS);

export type CategoryTranslation = {
  locale: SupportedLocale;
  name: string;
  description: string;
};

export type CategoryRecord = BaseDocumentFields &
  SoftDeleteFields & {
    translations: CategoryTranslation[];
    slug: string;
    bannerMediaId: Types.ObjectId | null;
    imageMediaId: Types.ObjectId | null;
    status: CategoryStatus;
    sortOrder: number;
    seoPageId: Types.ObjectId | null;
  };

const optionalObjectId = (ref: string) => ({
  type: Schema.Types.ObjectId,
  ref,
  default: null,
  validate: {
    validator: (value: Types.ObjectId | null) => value === null || isValidObjectId(value),
    message: `Reference to ${ref} must be a valid ObjectId.`,
  },
});

export const categorySchema = createBaseSchema<CategoryRecord>(
  {
    translations: createTranslationsField<CategoryTranslation>(
      {
        name: { type: String, required: true, trim: true, minlength: 2, maxlength: 160 },
        description: { type: String, required: true, trim: true, minlength: 1, maxlength: 20_000 },
      },
      { canonicalTextFields: ["name", "description"] },
    ),
    slug: createSlugField(),
    bannerMediaId: optionalObjectId("Media"),
    imageMediaId: optionalObjectId("Media"),
    status: { type: String, enum: CATEGORY_STATUSES, required: true, default: "draft" },
    sortOrder: {
      type: Number,
      required: true,
      default: 0,
      validate: {
        validator: (value: number) => Number.isSafeInteger(value) && value >= 0,
        message: "Category sort order must be a nonnegative safe integer.",
      },
    },
    seoPageId: optionalObjectId("SeoPage"),
  },
  {
    collection: "categories",
    schemaVersion: 1,
    softDelete: true,
    searchSourcePaths: ["translations"],
  },
);

categorySchema.pre("validate", function generateInitialSlug() {
  if (!this.slug) {
    const englishName = this.translations?.find((entry) => entry.locale === "en")?.name;
    if (!englishName) return;
    try {
      this.slug = normalizeSlug(englishName);
    } catch {
      this.invalidate("slug", "English category name cannot produce a valid slug.");
      return;
    }
  }
  if (!SLUG_PATTERN.test(this.slug) || RESERVED_CATEGORY_SLUGS.has(this.slug)) {
    this.invalidate("slug", "Category slug is invalid or reserved.");
  }
});

categorySchema.index({ status: 1, sortOrder: 1, _id: 1 }, { name: "category_status_sort" });
categorySchema.index(
  { deletedAt: 1, status: 1, sortOrder: 1, _id: 1 },
  { name: "category_active_status_sort" },
);
categorySchema.index(
  { "translations.name": "text", "translations.description": "text" },
  {
    name: "category_text_search",
    default_language: "none",
    weights: { "translations.name": 5, "translations.description": 1 },
  },
);
categorySchema.index({ bannerMediaId: 1 }, { name: "category_banner_media_ref" });
categorySchema.index({ imageMediaId: 1 }, { name: "category_image_media_ref" });
categorySchema.index({ seoPageId: 1 }, { name: "category_seo_ref", sparse: true });

export function getCategoryModel(connection: Connection): Model<CategoryRecord> {
  return (
    (connection.models.Category as Model<CategoryRecord> | undefined) ??
    connection.model<CategoryRecord>("Category", categorySchema)
  );
}
