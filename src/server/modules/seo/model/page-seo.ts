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
import { SLUG_MAX_LENGTH, SLUG_PATTERN } from "@/server/slugs";

export const SEO_TARGET_TYPES = ["entity", "static"] as const;
export const SEO_ENTITY_KINDS = ["category", "dish", "blog"] as const;
export const SEO_OPEN_GRAPH_TYPES = ["website", "article", "restaurant", "product"] as const;
export const SEO_TWITTER_CARD_TYPES = ["summary", "summary_large_image"] as const;
export const SEO_IMAGE_PREVIEW_VALUES = ["none", "standard", "large"] as const;
export const SEO_STRUCTURED_DATA_TYPES = [
  "web-page",
  "website",
  "organization",
  "local-business",
  "food-establishment",
  "restaurant",
  "menu",
  "menu-item",
  "product",
  "article",
  "faq-page",
  "breadcrumb-list",
] as const;
export const SEO_MANUAL_ROOT_FIELDS = [
  "route",
  "canonicalUrl",
  "shareImage",
  "openGraphType",
  "structuredData",
] as const;
export const SEO_MANUAL_TRANSLATION_FIELDS = [
  "title",
  "description",
  "keywords",
  "openGraphTitle",
  "openGraphDescription",
  "twitterTitle",
  "twitterDescription",
] as const;

export const SEO_MAX_KEYWORDS = 20;
export const SEO_MAX_STRUCTURED_DATA_BYTES = 32_768;
export const SEO_MAX_STRUCTURED_DATA_DEPTH = 6;

export type SeoTargetType = (typeof SEO_TARGET_TYPES)[number];
export type SeoEntityKind = (typeof SEO_ENTITY_KINDS)[number];
export type SeoOpenGraphType = (typeof SEO_OPEN_GRAPH_TYPES)[number];
export type SeoTwitterCardType = (typeof SEO_TWITTER_CARD_TYPES)[number];
export type SeoImagePreview = (typeof SEO_IMAGE_PREVIEW_VALUES)[number];
export type SeoStructuredDataType = (typeof SEO_STRUCTURED_DATA_TYPES)[number];
export type SeoManualRootField = (typeof SEO_MANUAL_ROOT_FIELDS)[number];
export type SeoManualTranslationField = (typeof SEO_MANUAL_TRANSLATION_FIELDS)[number];

export type SeoTranslationManualOverrides = {
  fields: SeoManualTranslationField[];
  locale: SupportedLocale;
};

export type SeoManualOverrides = {
  root: SeoManualRootField[];
  translations: SeoTranslationManualOverrides[];
};

export type SeoSocialTranslation = {
  description: string | null;
  title: string | null;
};

export type PageSeoTranslation = {
  locale: SupportedLocale;
  title: string;
  description: string;
  keywords: string[];
  openGraph: SeoSocialTranslation;
  twitter: SeoSocialTranslation;
};

export type SeoRobotsDirectives = {
  follow: boolean;
  index: boolean;
  maxImagePreview: SeoImagePreview;
  maxSnippet: number;
  maxVideoPreview: number;
  noArchive: boolean;
  noImageIndex: boolean;
  noSnippet: boolean;
};

export type SeoOpenGraphData = {
  siteName: string | null;
  type: SeoOpenGraphType;
};

export type SeoTwitterData = {
  card: SeoTwitterCardType;
  creator: string | null;
  site: string | null;
};

export type SeoStructuredData = {
  inputs: Record<string, unknown>;
  types: SeoStructuredDataType[];
};

export type PageSeoRecord = BaseDocumentFields &
  SoftDeleteFields & {
    active: boolean;
    canonicalUrl: string | null;
    entityId: Types.ObjectId | null;
    entityKind: SeoEntityKind | null;
    openGraph: SeoOpenGraphData;
    manualOverrides: SeoManualOverrides;
    path: string;
    robots: SeoRobotsDirectives;
    shareImageMediaId: Types.ObjectId | null;
    slug: string;
    staticPageKey: string | null;
    structuredData: SeoStructuredData;
    targetKey: string;
    targetType: SeoTargetType;
    translations: PageSeoTranslation[];
    twitter: SeoTwitterData;
  };

const STATIC_PAGE_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const TWITTER_HANDLE_PATTERN = /^@[A-Za-z0-9_]{1,15}$/u;
const FORBIDDEN_STRUCTURED_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export function isNormalizedSeoPath(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 2_048) return false;
  if (value === "/") return true;
  if (!value.startsWith("/") || value.endsWith("/") || value.includes("//")) return false;
  if (value.includes("?") || value.includes("#") || value.includes("\\")) return false;

  const segments = value.slice(1).split("/");
  return segments.every((segment) => SLUG_PATTERN.test(segment));
}

export function isSafeCanonicalUrl(value: unknown): value is string | null {
  if (value === null) return true;
  if (typeof value !== "string" || value.length > 2_048) return false;

  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.username === "" &&
      url.password === "" &&
      url.search === "" &&
      url.hash === "" &&
      isNormalizedSeoPath(url.pathname)
    );
  } catch {
    return false;
  }
}

function inspectStructuredValue(value: unknown, depth: number, seen: Set<object>): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || depth > SEO_MAX_STRUCTURED_DATA_DEPTH || seen.has(value)) {
    return false;
  }

  seen.add(value);
  if (Array.isArray(value)) {
    const valid =
      value.length <= 50 && value.every((entry) => inspectStructuredValue(entry, depth + 1, seen));
    seen.delete(value);
    return valid;
  }

  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    seen.delete(value);
    return false;
  }

  const entries = Object.entries(value);
  const valid =
    entries.length <= 50 &&
    entries.every(
      ([key, entry]) =>
        key.length > 0 &&
        key.length <= 64 &&
        !key.startsWith("$") &&
        !key.includes(".") &&
        !FORBIDDEN_STRUCTURED_KEYS.has(key) &&
        inspectStructuredValue(entry, depth + 1, seen),
    );
  seen.delete(value);
  return valid;
}

export function isSafeStructuredDataInputs(value: unknown): value is Record<string, unknown> {
  if (!inspectStructuredValue(value, 0, new Set())) return false;
  try {
    return (
      new TextEncoder().encode(JSON.stringify(value)).byteLength <= SEO_MAX_STRUCTURED_DATA_BYTES
    );
  } catch {
    return false;
  }
}

const uniqueKeywords = {
  validator: (values: readonly string[]) =>
    values.length <= SEO_MAX_KEYWORDS &&
    new Set(values.map((value) => value.toLocaleLowerCase("en"))).size === values.length,
  message: `SEO keywords must contain at most ${SEO_MAX_KEYWORDS} case-insensitively unique values.`,
};

const socialTranslationSchema = new Schema<SeoSocialTranslation>(
  {
    title: { type: String, trim: true, maxlength: 100, default: null },
    description: { type: String, trim: true, maxlength: 220, default: null },
  },
  { _id: false, id: false },
);

const robotsSchema = new Schema<SeoRobotsDirectives>(
  {
    index: { type: Boolean, required: true, default: true },
    follow: { type: Boolean, required: true, default: true },
    noArchive: { type: Boolean, required: true, default: false },
    noImageIndex: { type: Boolean, required: true, default: false },
    noSnippet: { type: Boolean, required: true, default: false },
    maxSnippet: { type: Number, required: true, default: -1, min: -1, max: 10_000 },
    maxImagePreview: {
      type: String,
      enum: SEO_IMAGE_PREVIEW_VALUES,
      required: true,
      default: "large",
    },
    maxVideoPreview: { type: Number, required: true, default: -1, min: -1, max: 86_400 },
  },
  { _id: false, id: false },
);

const openGraphSchema = new Schema<SeoOpenGraphData>(
  {
    type: { type: String, enum: SEO_OPEN_GRAPH_TYPES, required: true, default: "website" },
    siteName: { type: String, trim: true, maxlength: 100, default: null },
  },
  { _id: false, id: false },
);

const twitterSchema = new Schema<SeoTwitterData>(
  {
    card: {
      type: String,
      enum: SEO_TWITTER_CARD_TYPES,
      required: true,
      default: "summary_large_image",
    },
    site: {
      type: String,
      trim: true,
      default: null,
      validate: {
        validator: (value: string | null) => value === null || TWITTER_HANDLE_PATTERN.test(value),
        message: "Twitter site must be a valid @handle.",
      },
    },
    creator: {
      type: String,
      trim: true,
      default: null,
      validate: {
        validator: (value: string | null) => value === null || TWITTER_HANDLE_PATTERN.test(value),
        message: "Twitter creator must be a valid @handle.",
      },
    },
  },
  { _id: false, id: false },
);

const structuredDataSchema = new Schema<SeoStructuredData>(
  {
    types: {
      type: [{ type: String, enum: SEO_STRUCTURED_DATA_TYPES }],
      default: [],
      validate: {
        validator: (values: readonly string[]) => new Set(values).size === values.length,
        message: "Structured-data types must be unique.",
      },
    },
    inputs: {
      type: Schema.Types.Mixed,
      default: () => ({}),
      validate: {
        validator: isSafeStructuredDataInputs,
        message: "Structured-data inputs must be bounded, acyclic, plain JSON data.",
      },
    },
  },
  { _id: false, id: false },
);

const translationManualOverridesSchema = new Schema<SeoTranslationManualOverrides>(
  {
    locale: { type: String, enum: ["en", "pt-PT", "fa"], immutable: true, required: true },
    fields: {
      type: [{ type: String, enum: SEO_MANUAL_TRANSLATION_FIELDS }],
      default: [],
      validate: {
        validator: (values: readonly string[]) => new Set(values).size === values.length,
        message: "Manual translation fields must be unique.",
      },
    },
  },
  { _id: false, id: false },
);

const manualOverridesSchema = new Schema<SeoManualOverrides>(
  {
    root: {
      type: [{ type: String, enum: SEO_MANUAL_ROOT_FIELDS }],
      default: [],
      validate: {
        validator: (values: readonly string[]) => new Set(values).size === values.length,
        message: "Manual root fields must be unique.",
      },
    },
    translations: {
      type: [translationManualOverridesSchema],
      default: [],
      validate: {
        validator: (values: readonly SeoTranslationManualOverrides[]) =>
          new Set(values.map((value) => value.locale)).size === values.length,
        message: "Manual translation overrides must contain one entry per locale.",
      },
    },
  },
  { _id: false, id: false },
);

export const pageSeoSchema = createBaseSchema<PageSeoRecord>(
  {
    targetType: { type: String, enum: SEO_TARGET_TYPES, immutable: true, required: true },
    entityKind: { type: String, enum: SEO_ENTITY_KINDS, immutable: true, default: null },
    entityId: {
      type: Schema.Types.ObjectId,
      immutable: true,
      default: null,
      validate: {
        validator: (value: Types.ObjectId | null) => value === null || isValidObjectId(value),
        message: "SEO entity reference must be a valid ObjectId.",
      },
    },
    staticPageKey: {
      type: String,
      trim: true,
      lowercase: true,
      immutable: true,
      maxlength: 100,
      default: null,
      validate: {
        validator: (value: string | null) => value === null || STATIC_PAGE_KEY_PATTERN.test(value),
        message: "Static page key must be a normalized lowercase key.",
      },
    },
    targetKey: { type: String, required: true, immutable: true },
    path: {
      type: String,
      required: true,
      trim: true,
      validate: { validator: isNormalizedSeoPath, message: "SEO path must be normalized." },
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      maxlength: SLUG_MAX_LENGTH,
      validate: {
        validator: (value: string) => SLUG_PATTERN.test(value),
        message: "SEO slug must be a normalized lowercase ASCII URL segment.",
      },
    },
    translations: createTranslationsField<PageSeoTranslation>(
      {
        title: { type: String, required: true, trim: true, minlength: 1, maxlength: 70 },
        description: { type: String, required: true, trim: true, minlength: 1, maxlength: 170 },
        keywords: {
          type: [{ type: String, required: true, trim: true, minlength: 1, maxlength: 60 }],
          default: [],
          validate: uniqueKeywords,
        },
        openGraph: { type: socialTranslationSchema, default: () => ({}) },
        twitter: { type: socialTranslationSchema, default: () => ({}) },
      },
      { canonicalTextFields: ["title", "description"] },
    ),
    canonicalUrl: {
      type: String,
      trim: true,
      default: null,
      validate: {
        validator: isSafeCanonicalUrl,
        message: "Canonical URL must be credential-free HTTPS with a normalized path.",
      },
    },
    robots: { type: robotsSchema, required: true, default: () => ({}) },
    openGraph: { type: openGraphSchema, required: true, default: () => ({}) },
    twitter: { type: twitterSchema, required: true, default: () => ({}) },
    shareImageMediaId: {
      type: Schema.Types.ObjectId,
      ref: "Media",
      default: null,
      validate: {
        validator: (value: Types.ObjectId | null) => value === null || isValidObjectId(value),
        message: "SEO share image must be a valid Media ObjectId.",
      },
    },
    structuredData: { type: structuredDataSchema, required: true, default: () => ({}) },
    manualOverrides: { type: manualOverridesSchema, required: true, default: () => ({}) },
    active: { type: Boolean, required: true, default: true },
  },
  {
    collection: "seo_pages",
    schemaVersion: 1,
    softDelete: true,
    searchSourcePaths: ["path", "slug", "translations", "staticPageKey"],
  },
);

pageSeoSchema.pre("validate", function validateSeoTarget() {
  if (this.targetType === "entity") {
    if (!this.entityKind) this.invalidate("entityKind", "Entity SEO requires an entity kind.");
    if (!this.entityId) this.invalidate("entityId", "Entity SEO requires an entity reference.");
    if (this.staticPageKey) {
      this.invalidate("staticPageKey", "Entity SEO cannot contain a static page key.");
    }
    if (this.entityKind && this.entityId) {
      this.targetKey = `entity:${this.entityKind}:${this.entityId.toHexString()}`;
    }
  } else if (this.targetType === "static") {
    if (!this.staticPageKey) {
      this.invalidate("staticPageKey", "Static SEO requires a static page key.");
    }
    if (this.entityKind) this.invalidate("entityKind", "Static SEO cannot contain an entity kind.");
    if (this.entityId)
      this.invalidate("entityId", "Static SEO cannot contain an entity reference.");
    if (this.staticPageKey) this.targetKey = `static:${this.staticPageKey}`;
  }

  if (this.path !== "/" && this.path.split("/").at(-1) !== this.slug) {
    this.invalidate("slug", "SEO slug must match the final normalized path segment.");
  }

  if (this.robots.noSnippet && this.robots.maxSnippet !== -1) {
    this.invalidate("robots.maxSnippet", "noSnippet cannot be combined with maxSnippet.");
  }
});

pageSeoSchema.index(
  { targetKey: 1 },
  {
    name: "seo_one_active_target",
    unique: true,
    partialFilterExpression: { active: true, deletedAt: null },
  },
);
pageSeoSchema.index(
  { path: 1 },
  {
    name: "seo_one_active_path",
    unique: true,
    partialFilterExpression: { active: true, deletedAt: null },
  },
);
pageSeoSchema.index({ entityKind: 1, entityId: 1 }, { name: "seo_entity_lookup", sparse: true });
pageSeoSchema.index({ staticPageKey: 1 }, { name: "seo_static_lookup", sparse: true });
pageSeoSchema.index({ shareImageMediaId: 1 }, { name: "seo_share_image_ref", sparse: true });
pageSeoSchema.index({ active: 1, updatedAt: -1, _id: 1 }, { name: "seo_management_list" });

export function getPageSeoModel(connection: Connection): Model<PageSeoRecord> {
  return (
    (connection.models.PageSeo as Model<PageSeoRecord> | undefined) ??
    connection.model<PageSeoRecord>("PageSeo", pageSeoSchema)
  );
}
