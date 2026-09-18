import "server-only";

import { isValidObjectId, Schema } from "mongoose";
import type { Connection, Model, Types } from "mongoose";

import {
  createBaseSchema,
  createTranslationsField,
  type BaseDocumentFields,
  type SoftDeleteFields,
} from "@/server/database/schema";
import type { SupportedLocale } from "@/constants";

import {
  MEDIA_BUCKET_PATTERN,
  MEDIA_CHECKSUM_PATTERN,
  MEDIA_FAILURE_CODES,
  MEDIA_KINDS,
  MEDIA_MIME_PATTERN,
  MEDIA_PROCESSING_STATES,
  MEDIA_PROVIDERS,
  MEDIA_SOURCES,
  isSafeExternalMediaUrl,
  isSafeMediaObjectKey,
  type MediaFailureCode,
  type MediaKind,
  type MediaProcessingState,
  type MediaProvider,
  type MediaSource,
} from "../validation/media-metadata";

export type MediaAltTranslation = { locale: SupportedLocale; alt: string };
export type MediaDimensions = { width: number; height: number };
export type MediaVariant = {
  key: string;
  mimeType: string;
  bytes: number;
  dimensions: MediaDimensions | null;
  checksum: string | null;
  processingState: MediaProcessingState;
  failureCode: MediaFailureCode | null;
};

export type MediaRecord = BaseDocumentFields &
  SoftDeleteFields & {
    source: MediaSource;
    provider: MediaProvider;
    objectKey: string | null;
    bucket: string | null;
    externalUrl: string | null;
    originalName: string;
    mimeType: string;
    kind: MediaKind;
    bytes: number | null;
    dimensions: MediaDimensions | null;
    durationMs: number | null;
    pageCount: number | null;
    checksum: string | null;
    processingState: MediaProcessingState;
    failureCode: MediaFailureCode | null;
    variants: MediaVariant[];
    translations: MediaAltTranslation[];
    uploaderId: Types.ObjectId;
    usageCount: number;
  };

const positiveInteger = {
  type: Number,
  min: 1,
  validate: {
    validator: (value: number | null) => value === null || Number.isSafeInteger(value),
    message: "Media measurements must be positive safe integers.",
  },
} as const;

const checksumField = {
  type: String,
  default: null,
  validate: {
    validator: (value: string | null) => value === null || MEDIA_CHECKSUM_PATTERN.test(value),
    message: "Media checksum must be a lowercase SHA-256 hex digest.",
  },
} as const;

const dimensionsSchema = new Schema<MediaDimensions>(
  {
    width: { ...positiveInteger, required: true },
    height: { ...positiveInteger, required: true },
  },
  { _id: false, id: false },
);

const variantSchema = new Schema<MediaVariant>(
  {
    key: {
      type: String,
      required: true,
      validate: { validator: isSafeMediaObjectKey },
    },
    mimeType: {
      type: String,
      required: true,
      validate: { validator: (value: string) => MEDIA_MIME_PATTERN.test(value) },
    },
    bytes: { ...positiveInteger, required: true },
    dimensions: { type: dimensionsSchema, default: null },
    checksum: checksumField,
    processingState: { type: String, enum: MEDIA_PROCESSING_STATES, required: true },
    failureCode: { type: String, enum: MEDIA_FAILURE_CODES, default: null },
  },
  { _id: false, id: false },
);

export const mediaSchema = createBaseSchema<MediaRecord>(
  {
    source: { type: String, enum: MEDIA_SOURCES, required: true },
    provider: { type: String, enum: MEDIA_PROVIDERS, required: true },
    objectKey: {
      type: String,
      default: null,
      validate: {
        validator: (value: string | null) => value === null || isSafeMediaObjectKey(value),
      },
    },
    bucket: {
      type: String,
      default: null,
      validate: {
        validator: (value: string | null) => value === null || MEDIA_BUCKET_PATTERN.test(value),
      },
    },
    externalUrl: {
      type: String,
      default: null,
      validate: {
        validator: (value: string | null) => value === null || isSafeExternalMediaUrl(value),
      },
    },
    originalName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
      validate: { validator: (value: string) => !/[\x00-\x1f\x7f]/u.test(value) },
    },
    mimeType: {
      type: String,
      required: true,
      validate: { validator: (value: string) => MEDIA_MIME_PATTERN.test(value) },
    },
    kind: { type: String, enum: MEDIA_KINDS, required: true },
    bytes: { ...positiveInteger, default: null },
    dimensions: { type: dimensionsSchema, default: null },
    durationMs: { ...positiveInteger, default: null },
    pageCount: { ...positiveInteger, default: null },
    checksum: checksumField,
    processingState: { type: String, enum: MEDIA_PROCESSING_STATES, required: true },
    failureCode: { type: String, enum: MEDIA_FAILURE_CODES, default: null },
    variants: { type: [variantSchema], default: [] },
    translations: createTranslationsField<MediaAltTranslation>(
      { alt: { type: String, required: true, trim: true, maxlength: 500 } },
      { canonicalTextFields: ["alt"] },
    ),
    uploaderId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Admin",
      validate: { validator: (value: Types.ObjectId) => isValidObjectId(value) },
    },
    usageCount: {
      type: Number,
      required: true,
      default: 0,
      validate: {
        validator: (value: number) => Number.isSafeInteger(value) && value >= 0,
        message: "Media usage count must be a nonnegative safe integer.",
      },
    },
  },
  { collection: "media", schemaVersion: 1, softDelete: true, searchSourcePaths: ["originalName"] },
);

mediaSchema.pre("validate", function validateMediaState() {
  const managed = this.source === "managed";
  if (managed !== (this.provider === "minio")) {
    this.invalidate("provider", "Media source and provider must agree.");
  }
  if (managed) {
    if (!this.bucket) this.invalidate("bucket", "Managed media requires a bucket.");
    if (!this.objectKey) this.invalidate("objectKey", "Managed media requires an object key.");
    if (this.externalUrl)
      this.invalidate("externalUrl", "Managed media cannot have an external URL.");
    if (this.bytes === null) this.invalidate("bytes", "Managed media requires a byte count.");
    if (this.processingState === "ready" && !this.checksum) {
      this.invalidate("checksum", "Ready managed media requires a checksum.");
    }
  } else {
    if (!this.externalUrl) this.invalidate("externalUrl", "External media requires an HTTPS URL.");
    if (this.bucket || this.objectKey)
      this.invalidate("objectKey", "External media cannot claim local storage.");
    if (this.variants.length > 0)
      this.invalidate("variants", "External media cannot contain managed variants.");
    if (this.processingState !== "ready") {
      this.invalidate("processingState", "External media must be ready.");
    }
  }
  if (this.processingState === "failed" ? !this.failureCode : Boolean(this.failureCode)) {
    this.invalidate("failureCode", "Failure code must be present exactly when processing failed.");
  }
  if (this.kind !== "image" && this.dimensions) {
    this.invalidate("dimensions", "Only images may have dimensions.");
  }
  if (this.kind !== "video" && this.durationMs !== null) {
    this.invalidate("durationMs", "Only videos may have duration.");
  }
  if (this.kind !== "pdf" && this.pageCount !== null) {
    this.invalidate("pageCount", "Only PDFs may have page count.");
  }
  if (this.kind !== "image" && this.variants.length > 0) {
    this.invalidate("variants", "Only images may have derived variants.");
  }
  const keys = new Set<string>();
  for (const [index, variant] of this.variants.entries()) {
    if (keys.has(variant.key) || variant.key === this.objectKey) {
      this.invalidate(
        `variants.${index}.key`,
        "Variant keys must be unique and differ from the original.",
      );
    }
    keys.add(variant.key);
    if (
      variant.processingState === "failed" ? !variant.failureCode : Boolean(variant.failureCode)
    ) {
      this.invalidate(
        `variants.${index}.failureCode`,
        "Variant failure state and code must agree.",
      );
    }
    if (variant.processingState === "ready" && !variant.checksum) {
      this.invalidate(`variants.${index}.checksum`, "Ready variants require a checksum.");
    }
    if (!variant.mimeType.startsWith("image/")) {
      this.invalidate(`variants.${index}.mimeType`, "Image variants must have an image MIME type.");
    }
  }
});

mediaSchema.index(
  { bucket: 1, objectKey: 1 },
  {
    unique: true,
    name: "media_managed_object_unique",
    partialFilterExpression: { source: "managed", deletedAt: null },
  },
);
mediaSchema.index({ checksum: 1, deletedAt: 1 }, { name: "media_checksum_active" });
mediaSchema.index(
  { checksum: 1 },
  {
    unique: true,
    name: "media_ready_checksum_unique",
    partialFilterExpression: {
      source: "managed",
      processingState: "ready",
      deletedAt: null,
    },
  },
);
mediaSchema.index(
  { source: 1, processingState: 1, createdAt: -1 },
  { name: "media_processing_queue" },
);
mediaSchema.index({ kind: 1, deletedAt: 1, createdAt: -1 }, { name: "media_active_kind_recent" });
mediaSchema.index({ uploaderId: 1, createdAt: -1 }, { name: "media_uploader_recent" });

export function getMediaModel(connection: Connection): Model<MediaRecord> {
  return (
    (connection.models.Media as Model<MediaRecord> | undefined) ??
    connection.model<MediaRecord>("Media", mediaSchema)
  );
}
