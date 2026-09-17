import "server-only";

import { isIP } from "node:net";

import { isValidObjectId } from "mongoose";
import type { Connection, Model, Types } from "mongoose";

import { createBaseSchema, type BaseDocumentFields } from "@/server/database/schema";

export const SESSION_ACTOR_KINDS = ["admin", "customer"] as const;
export type SessionActorKind = (typeof SESSION_ACTOR_KINDS)[number];

export const SESSION_REVOCATION_REASONS = [
  "logout",
  "logout-all",
  "password-change",
  "password-reset",
  "role-change",
  "account-disabled",
  "security",
  "login-rotation",
] as const;
export type SessionRevocationReason = (typeof SESSION_REVOCATION_REASONS)[number];

export type SessionRecord = BaseDocumentFields & {
  tokenHash: string;
  actorKind: SessionActorKind;
  actorId: Types.ObjectId;
  audience: SessionActorKind;
  passwordVersion: number;
  persistent: boolean;
  lastSeenAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  revocationReason: SessionRevocationReason | null;
  ipAddress: string | null;
  userAgent: string | null;
};

const sessionSchema = createBaseSchema<SessionRecord>(
  {
    tokenHash: {
      type: String,
      required: true,
      select: false,
      immutable: true,
      validate: {
        validator: (value: string) => /^[a-f0-9]{64}$/u.test(value),
        message: "A SHA-256 token digest is required.",
      },
    },
    actorKind: { type: String, enum: SESSION_ACTOR_KINDS, required: true, immutable: true },
    actorId: {
      type: "ObjectId",
      required: true,
      immutable: true,
      validate: { validator: isValidObjectId, message: "A valid actor ID is required." },
    },
    audience: { type: String, enum: SESSION_ACTOR_KINDS, required: true, immutable: true },
    passwordVersion: {
      type: Number,
      required: true,
      default: 1,
      validate: {
        validator: (value: number) => Number.isSafeInteger(value) && value >= 1,
      },
    },
    persistent: { type: Boolean, required: true, default: false },
    lastSeenAt: { type: Date, required: true, default: Date.now },
    expiresAt: { type: Date, required: true, immutable: true },
    revokedAt: { type: Date, default: null },
    revocationReason: { type: String, enum: SESSION_REVOCATION_REASONS, default: null },
    ipAddress: {
      type: String,
      default: null,
      select: false,
      validate: { validator: (value: string | null) => value === null || isIP(value) !== 0 },
    },
    userAgent: {
      type: String,
      default: null,
      maxlength: 512,
      validate: {
        validator: (value: string | null) => value === null || !/[\p{Cc}\p{Cf}]/u.test(value),
      },
    },
  },
  { collection: "sessions" },
);

sessionSchema.index({ tokenHash: 1 }, { unique: true, name: "sessions_token_hash_unique" });
sessionSchema.index({ actorKind: 1, actorId: 1, revokedAt: 1, expiresAt: 1 });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "sessions_expiry_ttl" });

sessionSchema.pre("validate", function validateSessionState() {
  if (this.actorKind !== this.audience) {
    this.invalidate("audience", "Session actor kind and audience must match.");
  }
  if (Boolean(this.revokedAt) !== Boolean(this.revocationReason)) {
    this.invalidate("revocationReason", "Revocation timestamp and reason must agree.");
  }
  if (this.lastSeenAt && this.expiresAt && this.lastSeenAt > this.expiresAt) {
    this.invalidate("lastSeenAt", "Last-seen time cannot exceed expiry.");
  }
});

const baseJsonOptions = sessionSchema.get("toJSON") as {
  transform?: (document: unknown, value: Record<string, unknown>) => Record<string, unknown>;
};
sessionSchema.set("toJSON", {
  ...baseJsonOptions,
  transform(document: unknown, value: Record<string, unknown>) {
    const serialized = baseJsonOptions.transform?.(document, value) ?? value;
    delete serialized.tokenHash;
    delete serialized.ipAddress;
    return serialized;
  },
});

export function getSessionModel(connection: Connection): Model<SessionRecord> {
  return (
    (connection.models.Session as Model<SessionRecord> | undefined) ??
    connection.model<SessionRecord>("Session", sessionSchema)
  );
}
