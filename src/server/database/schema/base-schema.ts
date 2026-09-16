import { isValidObjectId, Schema, Types } from "mongoose";
import type { SchemaDefinition, SchemaOptions } from "mongoose";

import { buildNormalizedSearchText } from "./search-normalization";

export const ACTOR_KINDS = ["admin", "customer", "system"] as const;
export const NORMALIZED_SEARCH_FIELD = "normalizedSearchText" as const;
export const ACTIVE_DOCUMENT_FILTER = Object.freeze({ deletedAt: null });

export type ActorKind = (typeof ACTOR_KINDS)[number];

export type ActorMetadata = {
  actorId?: Types.ObjectId;
  kind: ActorKind;
};

export type BaseDocumentFields = {
  _id: Types.ObjectId;
  createdAt: Date;
  createdBy: ActorMetadata | null;
  schemaVersion: number;
  updatedAt: Date;
  updatedBy: ActorMetadata | null;
};

export type SoftDeleteFields = {
  deletedAt: Date | null;
  deletedBy: ActorMetadata | null;
};

export type NormalizedSearchFields = {
  normalizedSearchText: string;
};

export type BaseSchemaOptions = {
  collection?: string;
  schemaVersion?: number;
  searchSourcePaths?: readonly string[];
  softDelete?: boolean;
};

const actorMetadataSchema = new Schema<ActorMetadata>(
  {
    actorId: {
      type: Schema.Types.ObjectId,
      required(this: ActorMetadata) {
        return this.kind !== "system";
      },
      validate: {
        validator(value: Types.ObjectId | undefined) {
          return value === undefined || isValidObjectId(value);
        },
        message: "Actor metadata contains an invalid actorId.",
      },
    },
    kind: { type: String, enum: ACTOR_KINDS, required: true },
  },
  { _id: false, id: false },
);

function serializeMongoValue(value: unknown): unknown {
  if (value instanceof Types.ObjectId) return value.toHexString();
  if (Array.isArray(value)) return value.map(serializeMongoValue);
  if (value instanceof Date || value === null || typeof value !== "object") return value;

  const prototype = Object.getPrototypeOf(value) as object | null;
  if (prototype !== Object.prototype && prototype !== null) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [key, serializeMongoValue(nestedValue)]),
  );
}

function transformDocument(_document: unknown, returned: Record<string, unknown>) {
  const serialized = serializeMongoValue(returned) as Record<string, unknown>;
  const identifier = serialized._id;

  if (typeof identifier === "string") serialized.id = identifier;
  delete serialized._id;
  delete serialized.__v;
  delete serialized[NORMALIZED_SEARCH_FIELD];

  return serialized;
}

const commonSchemaOptions = {
  id: false,
  minimize: true,
  optimisticConcurrency: true,
  timestamps: true,
  toJSON: { flattenMaps: true, transform: transformDocument, virtuals: true },
  toObject: { flattenMaps: true, virtuals: true },
} as const satisfies SchemaOptions;

export function createActorMetadata(kind: "system"): ActorMetadata;
export function createActorMetadata(
  kind: Exclude<ActorKind, "system">,
  actorId: string | Types.ObjectId,
): ActorMetadata;
export function createActorMetadata(
  kind: ActorKind,
  actorId?: string | Types.ObjectId,
): ActorMetadata {
  if (kind === "system") return { kind };
  if (!actorId || !isValidObjectId(actorId)) {
    throw new TypeError("Admin and customer actor metadata requires a valid actorId.");
  }
  return { actorId: new Types.ObjectId(actorId), kind };
}

export function createBaseSchema<DocumentType>(
  definition: SchemaDefinition<DocumentType>,
  options: BaseSchemaOptions = {},
): Schema<DocumentType> {
  const schemaVersion = options.schemaVersion ?? 1;
  if (!Number.isSafeInteger(schemaVersion) || schemaVersion < 1) {
    throw new RangeError("schemaVersion must be a positive safe integer.");
  }

  type RuntimeDocument = Record<string, unknown>;
  const runtimeDefinition = definition as unknown as SchemaDefinition<RuntimeDocument>;
  const schema = new Schema<RuntimeDocument>(runtimeDefinition, {
    ...commonSchemaOptions,
    ...(options.collection ? { collection: options.collection } : {}),
  });

  const baseDefinition: SchemaDefinition<RuntimeDocument> = {
    createdBy: { type: actorMetadataSchema, default: null },
    schemaVersion: { type: Number, default: schemaVersion, min: 1, required: true },
    updatedBy: { type: actorMetadataSchema, default: null },
  };
  schema.add(baseDefinition);

  if (options.softDelete) {
    const softDeleteDefinition: SchemaDefinition<RuntimeDocument> = {
      deletedAt: { type: Date, default: null },
      deletedBy: { type: actorMetadataSchema, default: null },
    };
    schema.add(softDeleteDefinition);
    schema.index({ deletedAt: 1 });
    schema.pre("validate", function validateSoftDeleteMetadata() {
      const hasDeletedAt = this.get("deletedAt") instanceof Date;
      const hasDeletedBy = this.get("deletedBy") !== null && this.get("deletedBy") !== undefined;
      if (hasDeletedAt !== hasDeletedBy) {
        this.invalidate(
          hasDeletedAt ? "deletedBy" : "deletedAt",
          "deletedAt and deletedBy must be set or cleared together.",
        );
      }
    });
  }

  const searchSourcePaths = [...(options.searchSourcePaths ?? [])];
  if (searchSourcePaths.length > 0) {
    if (searchSourcePaths.some((path) => path.trim().length === 0)) {
      throw new TypeError("searchSourcePaths cannot contain empty paths.");
    }

    const normalizedSearchDefinition: SchemaDefinition<RuntimeDocument> = {
      [NORMALIZED_SEARCH_FIELD]: { type: String, default: "", index: true, select: false },
    };
    schema.add(normalizedSearchDefinition);
    schema.pre("validate", function setNormalizedSearchText() {
      const values = searchSourcePaths.map((path) => this.get(path));
      this.set(NORMALIZED_SEARCH_FIELD, buildNormalizedSearchText(values));
    });
  }

  // Mongoose cannot infer fields added dynamically from runtime options. The
  // public generic remains the caller's explicit persistence contract.
  return schema as unknown as Schema<DocumentType>;
}
