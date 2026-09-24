import "server-only";

import { isValidObjectId, Schema } from "mongoose";
import type { Connection, Model, Types } from "mongoose";

import { SUPPORTED_LOCALES, type SupportedLocale } from "@/constants";
import { createBaseSchema, type BaseDocumentFields } from "@/server/database/schema";

export const SETTINGS_COLLECTION = "settings_sections" as const;
export const SETTINGS_SCHEMA_VERSION = 2 as const;
export const SETTINGS_SECTION_KEYS = [
  "homepage",
  "contact",
  "social",
  "about",
  "faq",
  "terms",
  "languages",
] as const;
export const SETTINGS_PUBLICATION_POLICIES = ["staged", "direct"] as const;

export type SettingsSectionKey = (typeof SETTINGS_SECTION_KEYS)[number];
export type SettingsPublicationPolicy = (typeof SETTINGS_PUBLICATION_POLICIES)[number];
export type SettingsJsonObject = Record<string, unknown>;

export type SettingsTranslation<Value extends SettingsJsonObject = SettingsJsonObject> = {
  locale: SupportedLocale;
  value: Value;
};

export type SettingsRevision<
  Data extends SettingsJsonObject = SettingsJsonObject,
  TranslationValue extends SettingsJsonObject = SettingsJsonObject,
> = {
  data: Data;
  editedAt: Date;
  editedByAdminId: Types.ObjectId;
  publishedAt: Date | null;
  revision: number;
  translations: SettingsTranslation<TranslationValue>[];
};

type SettingsSectionDefinition = Readonly<{
  publicationPolicy: SettingsPublicationPolicy;
  schemaVersion: number;
}>;

export const SETTINGS_SECTION_REGISTRY = Object.freeze({
  homepage: { publicationPolicy: "staged", schemaVersion: SETTINGS_SCHEMA_VERSION },
  contact: { publicationPolicy: "direct", schemaVersion: SETTINGS_SCHEMA_VERSION },
  social: { publicationPolicy: "direct", schemaVersion: SETTINGS_SCHEMA_VERSION },
  about: { publicationPolicy: "staged", schemaVersion: SETTINGS_SCHEMA_VERSION },
  faq: { publicationPolicy: "staged", schemaVersion: SETTINGS_SCHEMA_VERSION },
  terms: { publicationPolicy: "staged", schemaVersion: SETTINGS_SCHEMA_VERSION },
  languages: { publicationPolicy: "direct", schemaVersion: SETTINGS_SCHEMA_VERSION },
} satisfies Record<SettingsSectionKey, SettingsSectionDefinition>);

export type SettingsPolicyFor<Key extends SettingsSectionKey> =
  (typeof SETTINGS_SECTION_REGISTRY)[Key]["publicationPolicy"];

export type SettingsSectionRecord<
  Key extends SettingsSectionKey = SettingsSectionKey,
  Data extends SettingsJsonObject = SettingsJsonObject,
  TranslationValue extends SettingsJsonObject = SettingsJsonObject,
> = BaseDocumentFields & {
  draft: SettingsRevision<Data, TranslationValue> | null;
  key: Key;
  publicationPolicy: SettingsPolicyFor<Key>;
  published: SettingsRevision<Data, TranslationValue> | null;
};

export function isSettingsSectionKey(value: unknown): value is SettingsSectionKey {
  return typeof value === "string" && (SETTINGS_SECTION_KEYS as readonly string[]).includes(value);
}

export function publicationPolicyForSettingsSection(
  key: SettingsSectionKey,
): SettingsPublicationPolicy {
  return SETTINGS_SECTION_REGISTRY[key].publicationPolicy;
}

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const MAX_JSON_DEPTH = 8;
const MAX_JSON_BYTES = 256 * 1024;

function inspectJsonValue(value: unknown, depth: number, seen: Set<object>): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || depth > MAX_JSON_DEPTH || seen.has(value)) return false;

  seen.add(value);
  if (Array.isArray(value)) {
    const valid =
      value.length <= 500 && value.every((entry) => inspectJsonValue(entry, depth + 1, seen));
    seen.delete(value);
    return valid;
  }

  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    seen.delete(value);
    return false;
  }
  const entries = Object.entries(value);
  const valid =
    entries.length <= 500 &&
    entries.every(
      ([key, entry]) =>
        key.length > 0 &&
        key.length <= 100 &&
        !key.startsWith("$") &&
        !key.includes(".") &&
        !FORBIDDEN_KEYS.has(key) &&
        inspectJsonValue(entry, depth + 1, seen),
    );
  seen.delete(value);
  return valid;
}

export function isSafeSettingsJsonObject(value: unknown): value is SettingsJsonObject {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !inspectJsonValue(value, 0, new Set())
  ) {
    return false;
  }
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength <= MAX_JSON_BYTES;
  } catch {
    return false;
  }
}

function validTranslations(values: unknown): boolean {
  if (!Array.isArray(values) || values.length === 0) return false;
  const locales = values.map((entry: unknown) =>
    entry !== null && typeof entry === "object" ? (entry as { locale?: unknown }).locale : null,
  );
  return (
    locales.every(
      (locale) =>
        typeof locale === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(locale),
    ) &&
    new Set(locales).size === locales.length &&
    locales.includes("en")
  );
}

const translationSchema = new Schema<SettingsTranslation>(
  {
    locale: { type: String, enum: SUPPORTED_LOCALES, immutable: true, required: true },
    value: {
      type: Schema.Types.Mixed,
      required: true,
      validate: {
        validator: isSafeSettingsJsonObject,
        message: "Settings translation values must be bounded plain JSON objects.",
      },
    },
  },
  { _id: false, id: false },
);

const revisionSchema = new Schema<SettingsRevision>(
  {
    revision: {
      type: Number,
      required: true,
      validate: {
        validator: (value: number) => Number.isSafeInteger(value) && value > 0,
        message: "Settings revision must be a positive safe integer.",
      },
    },
    translations: {
      type: [translationSchema],
      required: true,
      validate: {
        validator: validTranslations,
        message: "Settings translations require unique supported locales and canonical English.",
      },
    },
    data: {
      type: Schema.Types.Mixed,
      required: true,
      validate: {
        validator: isSafeSettingsJsonObject,
        message: "Settings data must be a bounded plain JSON object.",
      },
    },
    editedByAdminId: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
      validate: {
        validator: isValidObjectId,
        message: "Settings editor must reference an administrator.",
      },
    },
    editedAt: { type: Date, required: true },
    publishedAt: { type: Date, default: null },
  },
  { _id: false, id: false },
);

export const settingsSectionSchema = createBaseSchema<SettingsSectionRecord>(
  {
    key: { type: String, enum: SETTINGS_SECTION_KEYS, immutable: true, required: true },
    publicationPolicy: {
      type: String,
      enum: SETTINGS_PUBLICATION_POLICIES,
      immutable: true,
      required: true,
    },
    draft: { type: revisionSchema, default: null },
    published: { type: revisionSchema, default: null },
  },
  { collection: SETTINGS_COLLECTION, schemaVersion: SETTINGS_SCHEMA_VERSION },
);

settingsSectionSchema.pre("validate", function validateSettingsState() {
  if (!isSettingsSectionKey(this.key)) {
    this.invalidate("key", "Unknown settings section key.");
    return;
  }
  const definition = SETTINGS_SECTION_REGISTRY[this.key];
  if (this.schemaVersion !== definition.schemaVersion) {
    this.invalidate(
      "schemaVersion",
      `Settings section must be migrated to schema version ${definition.schemaVersion}.`,
    );
  }
  if (this.publicationPolicy !== definition.publicationPolicy) {
    this.invalidate("publicationPolicy", "Settings publication policy does not match its key.");
  }

  if (definition.publicationPolicy === "direct") {
    if (this.draft) this.invalidate("draft", "Direct-publish settings cannot contain a draft.");
    if (!this.published) {
      this.invalidate("published", "Direct-publish settings require published content.");
    }
  } else if (!this.draft && !this.published) {
    this.invalidate("draft", "Staged settings require a draft or published revision.");
  }

  if (this.draft?.publishedAt) {
    this.invalidate("draft.publishedAt", "Draft revisions cannot have a publication timestamp.");
  }
  if (this.published && !this.published.publishedAt) {
    this.invalidate(
      "published.publishedAt",
      "Published revisions require a publication timestamp.",
    );
  }
  if (this.draft && this.published && this.draft.revision <= this.published.revision) {
    this.invalidate("draft.revision", "A draft revision must be newer than published content.");
  }
});

settingsSectionSchema.index({ key: 1 }, { name: "settings_singleton_key", unique: true });
settingsSectionSchema.index(
  { publicationPolicy: 1, updatedAt: -1 },
  { name: "settings_policy_updated" },
);
settingsSectionSchema.index(
  { "draft.editedByAdminId": 1, updatedAt: -1 },
  { name: "settings_draft_editor" },
);
settingsSectionSchema.index(
  { "published.editedByAdminId": 1, "published.publishedAt": -1 },
  { name: "settings_published_editor" },
);

export function getSettingsSectionModel(connection: Connection): Model<SettingsSectionRecord> {
  return (
    (connection.models.SettingsSection as Model<SettingsSectionRecord> | undefined) ??
    connection.model<SettingsSectionRecord>("SettingsSection", settingsSectionSchema)
  );
}
