import "server-only";

import type { Connection, Model, Types } from "mongoose";

import { createBaseSchema, type BaseDocumentFields } from "@/server/database/schema";

type MobileVerificationRecord = BaseDocumentFields & {
  challengeHash: string;
  codeHash: string;
  customerId: Types.ObjectId;
  mobile: string;
  expiresAt: Date;
  purgeAt: Date;
  attempts: number;
  consumedAt: Date | null;
};

const schema = createBaseSchema<MobileVerificationRecord>(
  {
    challengeHash: { type: String, required: true, select: false, immutable: true },
    codeHash: { type: String, required: true, select: false, immutable: true },
    customerId: { type: "ObjectId", required: true, immutable: true },
    mobile: { type: String, required: true, immutable: true },
    expiresAt: { type: Date, required: true, immutable: true },
    purgeAt: { type: Date, required: true, immutable: true },
    attempts: { type: Number, required: true, default: 0, min: 0 },
    consumedAt: { type: Date, default: null },
  },
  { collection: "mobile_verifications" },
);
schema.index({ challengeHash: 1 }, { unique: true, name: "mobile_verifications_challenge_unique" });
schema.index({ customerId: 1, consumedAt: 1 });
schema.index(
  { customerId: 1 },
  {
    unique: true,
    partialFilterExpression: { consumedAt: null },
    name: "mobile_verifications_one_open_per_customer",
  },
);
schema.index({ purgeAt: 1 }, { expireAfterSeconds: 0, name: "mobile_verifications_purge_ttl" });

export function getMobileVerificationModel(
  connection: Connection,
): Model<MobileVerificationRecord> {
  return (
    (connection.models.MobileVerification as Model<MobileVerificationRecord> | undefined) ??
    connection.model<MobileVerificationRecord>("MobileVerification", schema)
  );
}
