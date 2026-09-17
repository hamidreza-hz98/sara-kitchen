import "server-only";

import type { Connection, Model, Types } from "mongoose";

import { createBaseSchema, type BaseDocumentFields } from "@/server/database/schema";

type PasswordResetRecord = BaseDocumentFields & {
  tokenHash: string;
  customerId: Types.ObjectId;
  passwordVersion: number;
  expiresAt: Date;
  consumedAt: Date | null;
};

const schema = createBaseSchema<PasswordResetRecord>(
  {
    tokenHash: { type: String, required: true, select: false, immutable: true },
    customerId: { type: "ObjectId", required: true, immutable: true },
    passwordVersion: { type: Number, required: true, min: 1, immutable: true },
    expiresAt: { type: Date, required: true, immutable: true },
    consumedAt: { type: Date, default: null },
  },
  { collection: "password_resets" },
);
schema.index({ tokenHash: 1 }, { unique: true, name: "password_resets_token_unique" });
schema.index({ customerId: 1, consumedAt: 1 });
schema.index(
  { customerId: 1 },
  {
    unique: true,
    partialFilterExpression: { consumedAt: null },
    name: "password_resets_one_open_per_customer",
  },
);
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "password_resets_expiry_ttl" });

export function getPasswordResetModel(connection: Connection): Model<PasswordResetRecord> {
  return (
    (connection.models.PasswordReset as Model<PasswordResetRecord> | undefined) ??
    connection.model<PasswordResetRecord>("PasswordReset", schema)
  );
}
