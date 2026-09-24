import "server-only";

import { isValidObjectId, Schema } from "mongoose";
import type { Connection, Model, Types } from "mongoose";

import type { SupportedLocale } from "@/constants";
import { RICH_TEXT_MAX_BYTES, isStoredRichText, type StoredRichText } from "@/lib/rich-text";
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

export const BLOG_STATUSES = ["draft", "scheduled", "published", "archived"] as const;
export const BLOG_MAX_READ_TIME_MINUTES = 1_440;
export const BLOG_MAX_TAGS = 20;
export const BLOG_MAX_RELATIONS = 30;
export const BLOG_CONTENT_MAX_BYTES = RICH_TEXT_MAX_BYTES;

export type BlogStatus = (typeof BLOG_STATUSES)[number];

export type BlogRichTextDocument = StoredRichText;

export type BlogTranslation = {
  content: BlogRichTextDocument;
  excerpt: string;
  locale: SupportedLocale;
  title: string;
};

export type BlogAuthorSnapshot = {
  displayName: string;
};

export type BlogRecord = BaseDocumentFields &
  SoftDeleteFields & {
    authorAdminId: Types.ObjectId;
    authorSnapshot: BlogAuthorSnapshot;
    bannerMediaId: Types.ObjectId | null;
    imageMediaId: Types.ObjectId | null;
    publishAt: Date | null;
    publishedAt: Date | null;
    readTimeMinutes: number;
    relatedBlogIds: Types.ObjectId[];
    relatedDishIds: Types.ObjectId[];
    seoPageId: Types.ObjectId | null;
    slug: string;
    status: BlogStatus;
    tags: string[];
    translations: BlogTranslation[];
    viewCount: number;
  };

const RESERVED_BLOG_SLUGS = new Set<string>(SYSTEM_RESERVED_SLUGS);

const optionalObjectId = (ref: string) => ({
  type: Schema.Types.ObjectId,
  ref,
  default: null,
  validate: {
    validator: (value: Types.ObjectId | null) => value === null || isValidObjectId(value),
    message: `Reference to ${ref} must be a valid ObjectId.`,
  },
});

const uniqueObjectIds = (values: readonly Types.ObjectId[]) =>
  values.length <= BLOG_MAX_RELATIONS &&
  values.every((value) => isValidObjectId(value)) &&
  new Set(values.map((value) => value.toHexString())).size === values.length;

const objectIdArray = (ref: string) => ({
  type: [{ type: Schema.Types.ObjectId, ref }],
  default: [],
  validate: {
    validator: uniqueObjectIds,
    message: `${ref} references must contain at most ${BLOG_MAX_RELATIONS} unique valid ObjectIds.`,
  },
});

const safeInteger = (minimum: number, maximum = Number.MAX_SAFE_INTEGER) => ({
  validator: (value: number) => Number.isSafeInteger(value) && value >= minimum && value <= maximum,
  message: `Value must be a safe integer from ${minimum} through ${maximum}.`,
});

const authorSnapshotSchema = new Schema<BlogAuthorSnapshot>(
  {
    displayName: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 160,
      set: (value: string) => value.trim().replace(/\s+/gu, " "),
    },
  },
  { _id: false, id: false },
);

export const blogSchema = createBaseSchema<BlogRecord>(
  {
    translations: createTranslationsField<BlogTranslation>(
      {
        title: { type: String, required: true, trim: true, minlength: 1, maxlength: 180 },
        excerpt: { type: String, required: true, trim: true, minlength: 1, maxlength: 500 },
        content: {
          type: Schema.Types.Mixed,
          required: true,
          validate: {
            validator: isStoredRichText,
            message: "Blog content must satisfy the current versioned rich-text policy.",
          },
        },
      },
      { canonicalTextFields: ["title", "excerpt"] },
    ),
    slug: createSlugField(),
    imageMediaId: optionalObjectId("Media"),
    bannerMediaId: optionalObjectId("Media"),
    readTimeMinutes: {
      type: Number,
      required: true,
      default: 1,
      validate: safeInteger(1, BLOG_MAX_READ_TIME_MINUTES),
    },
    authorAdminId: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
      validate: {
        validator: (value: Types.ObjectId) => isValidObjectId(value),
        message: "Blog author must be a valid Admin ObjectId.",
      },
    },
    authorSnapshot: { type: authorSnapshotSchema, required: true },
    status: { type: String, enum: BLOG_STATUSES, required: true, default: "draft" },
    publishAt: { type: Date, default: null },
    // The repository permits only the one-way null -> first publication transition and preserves
    // this timestamp through later lifecycle changes.
    publishedAt: { type: Date, default: null },
    tags: {
      type: [
        {
          type: String,
          trim: true,
          minlength: 1,
          maxlength: 64,
          validate: {
            validator: (value: string) => SLUG_PATTERN.test(value),
            message: "Blog tags must be normalized lowercase slug values.",
          },
        },
      ],
      default: [],
      validate: {
        validator: (values: string[]) =>
          values.length <= BLOG_MAX_TAGS && new Set(values).size === values.length,
        message: `Blog tags must contain at most ${BLOG_MAX_TAGS} unique values.`,
      },
    },
    relatedDishIds: objectIdArray("Dish"),
    relatedBlogIds: objectIdArray("Blog"),
    viewCount: { type: Number, required: true, default: 0, validate: safeInteger(0) },
    seoPageId: optionalObjectId("SeoPage"),
  },
  {
    collection: "blogs",
    schemaVersion: 1,
    softDelete: true,
    searchSourcePaths: ["translations", "tags", "authorSnapshot.displayName"],
  },
);

blogSchema.pre("validate", function validateBlogInvariants() {
  if (!this.slug) {
    const englishTitle = this.translations?.find((entry) => entry.locale === "en")?.title;
    if (englishTitle) {
      try {
        this.slug = normalizeSlug(englishTitle);
      } catch {
        this.invalidate("slug", "English blog title cannot produce a valid slug.");
      }
    }
  }
  if (this.slug && (!SLUG_PATTERN.test(this.slug) || RESERVED_BLOG_SLUGS.has(this.slug))) {
    this.invalidate("slug", "Blog slug is invalid or reserved.");
  }

  if (this.status === "scheduled") {
    if (!(this.publishAt instanceof Date) || Number.isNaN(this.publishAt.getTime())) {
      this.invalidate("publishAt", "Scheduled blogs require a valid publication time.");
    }
  } else if (this.publishAt) {
    this.invalidate("publishAt", "Only scheduled blogs can contain a publication time.");
  }

  if (this.status === "published" && !this.publishedAt) {
    this.invalidate("publishedAt", "Published blogs require a publication timestamp.");
  }
  // `publishedAt` is the immutable first-publication timestamp. Unpublished and re-scheduled
  // records retain it for attribution; current public visibility is determined only by status.

  if (this.relatedBlogIds.some((id) => id.equals(this._id))) {
    this.invalidate("relatedBlogIds", "A blog cannot relate to itself.");
  }
});

blogSchema.index(
  { deletedAt: 1, status: 1, publishedAt: -1, _id: 1 },
  { name: "blog_public_listing" },
);
blogSchema.index(
  { status: 1, publishAt: 1, _id: 1 },
  { name: "blog_publish_schedule", partialFilterExpression: { status: "scheduled" } },
);
blogSchema.index(
  { "translations.title": "text", "translations.excerpt": "text", tags: "text" },
  {
    name: "blog_text_search",
    default_language: "none",
    weights: { "translations.title": 8, "translations.excerpt": 3, tags: 2 },
  },
);
blogSchema.index({ authorAdminId: 1, createdAt: -1 }, { name: "blog_author_listing" });
blogSchema.index({ tags: 1, deletedAt: 1, status: 1 }, { name: "blog_tag_listing" });
blogSchema.index({ imageMediaId: 1 }, { name: "blog_image_media_ref" });
blogSchema.index({ bannerMediaId: 1 }, { name: "blog_banner_media_ref" });
blogSchema.index({ relatedDishIds: 1 }, { name: "blog_related_dish_refs" });
blogSchema.index({ relatedBlogIds: 1 }, { name: "blog_related_blog_refs" });
blogSchema.index({ viewCount: -1, _id: 1 }, { name: "blog_popular_listing" });
blogSchema.index({ seoPageId: 1 }, { name: "blog_seo_ref", sparse: true });

export function getBlogModel(connection: Connection): Model<BlogRecord> {
  return (
    (connection.models.Blog as Model<BlogRecord> | undefined) ??
    connection.model<BlogRecord>("Blog", blogSchema)
  );
}
