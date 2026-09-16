import "server-only";

import type { Connection, Model } from "mongoose";

import { createBaseSchema, type BaseDocumentFields } from "@/server/database/schema";

type SignupLimitRecord = BaseDocumentFields & {
  keyHash: string;
  count: number;
  expiresAt: Date;
};

const schema = createBaseSchema<SignupLimitRecord>(
  {
    keyHash: { type: String, required: true, select: false },
    count: { type: Number, required: true, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { collection: "signup_limits" },
);
schema.index({ keyHash: 1 }, { unique: true, name: "signup_limits_key_unique" });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "signup_limits_expiry_ttl" });

export function getSignupLimitModel(connection: Connection): Model<SignupLimitRecord> {
  return (
    (connection.models.SignupLimit as Model<SignupLimitRecord> | undefined) ??
    connection.model<SignupLimitRecord>("SignupLimit", schema)
  );
}
