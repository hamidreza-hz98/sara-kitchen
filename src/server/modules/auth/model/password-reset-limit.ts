import "server-only";

import type { Connection, Model } from "mongoose";

import { createBaseSchema, type BaseDocumentFields } from "@/server/database/schema";

type ResetLimitRecord = BaseDocumentFields & { keyHash: string; count: number; expiresAt: Date };

const schema = createBaseSchema<ResetLimitRecord>(
  {
    keyHash: { type: String, required: true, select: false },
    count: { type: Number, required: true, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { collection: "password_reset_limits" },
);
schema.index({ keyHash: 1 }, { unique: true, name: "password_reset_limits_key_unique" });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "password_reset_limits_expiry_ttl" });

export function getPasswordResetLimitModel(connection: Connection): Model<ResetLimitRecord> {
  return (
    (connection.models.PasswordResetLimit as Model<ResetLimitRecord> | undefined) ??
    connection.model<ResetLimitRecord>("PasswordResetLimit", schema)
  );
}
