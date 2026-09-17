import "server-only";

import { isValidObjectId, Schema } from "mongoose";
import type { Connection, Model, Types } from "mongoose";

import { createBaseSchema, type BaseDocumentFields } from "@/server/database/schema";

import {
  AUDIT_ACTOR_KINDS,
  AUDIT_NETWORK_POLICIES,
  AUDIT_OUTCOMES,
  AUDIT_SEVERITIES,
  AUDIT_TYPES,
  type AuditActorKind,
  type AuditActorSnapshot,
  type AuditContext,
  type AuditNetworkPolicy,
  type AuditOutcome,
  type AuditResourceSnapshot,
  type AuditSeverity,
  type AuditType,
} from "../types/audit-event";
import {
  AUDIT_ACTION_CODE_PATTERN,
  AUDIT_ENTITY_KIND_PATTERN,
  AUDIT_IP_HASH_PATTERN,
  AUDIT_REQUEST_ID_PATTERN,
  isEnglishAuditMessage,
  isSafeAuditContext,
  isSafeAuditText,
  isValidAuditNetwork,
} from "../validation/audit-event";

export const AUDIT_LOG_RETENTION_DAYS = 365;
export const AUDIT_LOG_RETENTION_MS = AUDIT_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1_000;
export const AUDIT_LOG_APPEND_ONLY_ERROR = "Audit records are append-only.";

type AuditActor = {
  kind: AuditActorKind;
  ref: Types.ObjectId | null;
  snapshot: AuditActorSnapshot;
};

type AuditResource = {
  kind: string;
  ref: string | null;
  snapshot: AuditResourceSnapshot;
};

type AuditNetwork = {
  policy: AuditNetworkPolicy;
  ipHash: string | null;
  ipAddress: string | null;
};

export type AuditLogRecord = BaseDocumentFields & {
  actionCode: string;
  message: string;
  actor: AuditActor;
  resource: AuditResource;
  outcome: AuditOutcome;
  severity: AuditSeverity;
  type: AuditType;
  requestId: string;
  context: AuditContext;
  network: AuditNetwork;
  userAgent: string | null;
  occurredAt: Date;
  expiresAt: Date;
};

const optionalSnapshotText = {
  type: String,
  default: null,
  maxlength: 128,
  validate: {
    validator: (value: string | null) => value === null || isSafeAuditText(value, 128),
    message: "Audit snapshots must contain bounded text without control characters.",
  },
} as const;

const actorSnapshotSchema = new Schema<AuditActorSnapshot>(
  {
    displayName: { ...optionalSnapshotText, maxlength: 120 },
    role: { ...optionalSnapshotText, maxlength: 64 },
  },
  { _id: false, id: false },
);

const resourceSnapshotSchema = new Schema<AuditResourceSnapshot>(
  {
    code: optionalSnapshotText,
    label: optionalSnapshotText,
    status: optionalSnapshotText,
  },
  { _id: false, id: false },
);

const actorSchema = new Schema<AuditActor>(
  {
    kind: { type: String, enum: AUDIT_ACTOR_KINDS, required: true },
    ref: {
      type: Schema.Types.ObjectId,
      default: null,
      validate: {
        validator: (value: Types.ObjectId | null) => value === null || isValidObjectId(value),
        message: "Audit actor reference must be a valid object ID.",
      },
    },
    snapshot: { type: actorSnapshotSchema, required: true },
  },
  { _id: false, id: false },
);

const resourceSchema = new Schema<AuditResource>(
  {
    kind: {
      type: String,
      required: true,
      maxlength: 64,
      validate: { validator: (value: string) => AUDIT_ENTITY_KIND_PATTERN.test(value) },
    },
    ref: {
      type: String,
      default: null,
      maxlength: 128,
      validate: {
        validator: (value: string | null) => value === null || isSafeAuditText(value, 128),
      },
    },
    snapshot: { type: resourceSnapshotSchema, required: true },
  },
  { _id: false, id: false },
);

const networkSchema = new Schema<AuditNetwork>(
  {
    policy: { type: String, enum: AUDIT_NETWORK_POLICIES, required: true },
    ipHash: {
      type: String,
      default: null,
      select: false,
      validate: {
        validator: (value: string | null) => value === null || AUDIT_IP_HASH_PATTERN.test(value),
      },
    },
    ipAddress: { type: String, default: null, select: false },
  },
  { _id: false, id: false },
);

const auditLogSchema = createBaseSchema<AuditLogRecord>(
  {
    actionCode: {
      type: String,
      required: true,
      immutable: true,
      maxlength: 160,
      validate: { validator: (value: string) => AUDIT_ACTION_CODE_PATTERN.test(value) },
    },
    message: {
      type: String,
      required: true,
      immutable: true,
      maxlength: 240,
      validate: {
        validator: isEnglishAuditMessage,
        message: "Audit messages must be bounded printable English text.",
      },
    },
    actor: { type: actorSchema, required: true, immutable: true },
    resource: { type: resourceSchema, required: true, immutable: true },
    outcome: { type: String, enum: AUDIT_OUTCOMES, required: true, immutable: true },
    severity: { type: String, enum: AUDIT_SEVERITIES, required: true, immutable: true },
    type: { type: String, enum: AUDIT_TYPES, required: true, immutable: true },
    requestId: {
      type: String,
      required: true,
      immutable: true,
      maxlength: 128,
      validate: { validator: (value: string) => AUDIT_REQUEST_ID_PATTERN.test(value) },
    },
    context: {
      type: Schema.Types.Mixed,
      default: () => ({}),
      immutable: true,
      validate: {
        validator: isSafeAuditContext,
        message: "Audit context contains prohibited, nested, oversized, or unsafe data.",
      },
    },
    network: { type: networkSchema, required: true, immutable: true },
    userAgent: {
      type: String,
      default: null,
      immutable: true,
      maxlength: 512,
      validate: {
        validator: (value: string | null) => value === null || isSafeAuditText(value, 512),
      },
    },
    occurredAt: { type: Date, required: true, default: Date.now, immutable: true },
    expiresAt: { type: Date, required: true, immutable: true, select: false },
  },
  { collection: "audit_logs", schemaVersion: 1 },
);

auditLogSchema.index({ occurredAt: -1 }, { name: "audit_logs_timeline" });
auditLogSchema.index(
  { "actor.kind": 1, "actor.ref": 1, occurredAt: -1 },
  { name: "audit_logs_actor_timeline" },
);
auditLogSchema.index(
  { "resource.kind": 1, "resource.ref": 1, occurredAt: -1 },
  { name: "audit_logs_resource_timeline" },
);
auditLogSchema.index(
  { actionCode: 1, outcome: 1, occurredAt: -1 },
  { name: "audit_logs_action_outcome" },
);
auditLogSchema.index({ requestId: 1 }, { name: "audit_logs_request" });
auditLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "audit_logs_retention_ttl" });

auditLogSchema.pre("validate", function enforceAuditInvariants() {
  if (!this.isNew) throw new Error(AUDIT_LOG_APPEND_ONLY_ERROR);
  this.createdBy = null;
  this.updatedBy = null;

  const actorHasReference = this.actor?.ref !== null && this.actor?.ref !== undefined;
  if ((this.actor?.kind === "admin" || this.actor?.kind === "customer") !== actorHasReference) {
    this.invalidate(
      "actor.ref",
      "Admin/customer audit actors require a reference; others forbid it.",
    );
  }
  if (
    this.network &&
    !isValidAuditNetwork(this.network.policy, this.network.ipHash, this.network.ipAddress)
  ) {
    this.invalidate("network", "Audit network metadata does not match its privacy policy.");
  }
  if (this.occurredAt && this.occurredAt.getTime() > Date.now() + 5 * 60_000) {
    this.invalidate("occurredAt", "Audit occurrence time cannot be more than five minutes ahead.");
  }
  if (this.occurredAt) {
    this.expiresAt = new Date(this.occurredAt.getTime() + AUDIT_LOG_RETENTION_MS);
  }
});

auditLogSchema.pre("save", function rejectExistingSave() {
  if (!this.isNew) throw new Error(AUDIT_LOG_APPEND_ONLY_ERROR);
});

const blockedOperations = [
  "updateOne",
  "updateMany",
  "replaceOne",
  "findOneAndUpdate",
  "findOneAndReplace",
  "deleteOne",
  "deleteMany",
  "findOneAndDelete",
] as const;

for (const operation of blockedOperations) {
  auditLogSchema.pre(operation, function rejectAuditMutation() {
    throw new Error(AUDIT_LOG_APPEND_ONLY_ERROR);
  });
}

auditLogSchema.pre("deleteOne", { document: true, query: false }, function rejectDocumentDelete() {
  throw new Error(AUDIT_LOG_APPEND_ONLY_ERROR);
});

auditLogSchema.pre("bulkWrite", function rejectAuditBulkMutation() {
  throw new Error(AUDIT_LOG_APPEND_ONLY_ERROR);
});

const baseJsonOptions = auditLogSchema.get("toJSON") as {
  transform?: (document: unknown, value: Record<string, unknown>) => Record<string, unknown>;
};
auditLogSchema.set("toJSON", {
  ...baseJsonOptions,
  transform(document: unknown, value: Record<string, unknown>) {
    const serialized = baseJsonOptions.transform?.(document, value) ?? value;
    delete serialized.expiresAt;
    const network = serialized.network as Record<string, unknown> | undefined;
    if (network) {
      delete network.ipHash;
      delete network.ipAddress;
    }
    return serialized;
  },
});

export function getAuditLogModel(connection: Connection): Model<AuditLogRecord> {
  return (
    (connection.models.AuditLog as Model<AuditLogRecord> | undefined) ??
    connection.model<AuditLogRecord>("AuditLog", auditLogSchema)
  );
}
