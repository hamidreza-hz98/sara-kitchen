import "server-only";

import type { Connection, Model } from "mongoose";

import { createBaseSchema, type BaseDocumentFields } from "@/server/database/schema";

type AuthenticationLimitRecord = BaseDocumentFields & {
  keyHash: string;
  count: number;
  expiresAt: Date;
};

const schema = createBaseSchema<AuthenticationLimitRecord>(
  {
    keyHash: { type: String, required: true, select: false },
    count: { type: Number, required: true, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { collection: "authentication_limits" },
);
schema.index({ keyHash: 1 }, { unique: true, name: "authentication_limits_key_unique" });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "authentication_limits_expiry_ttl" });

export function getAuthenticationLimitModel(
  connection: Connection,
): Model<AuthenticationLimitRecord> {
  return (
    (connection.models.AuthenticationLimit as Model<AuthenticationLimitRecord> | undefined) ??
    connection.model<AuthenticationLimitRecord>("AuthenticationLimit", schema)
  );
}
