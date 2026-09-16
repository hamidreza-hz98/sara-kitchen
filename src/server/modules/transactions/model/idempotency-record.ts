import type { Connection, Model } from "mongoose";

import { createBaseSchema } from "@/server/database/schema/base-schema";
import type { BaseDocumentFields } from "@/server/database/schema/base-schema";

const idempotencyRecordSchema = createBaseSchema<IdempotencyRecord>(
  {
    scope: { type: String, required: true, immutable: true },
    subject: { type: String, required: true, immutable: true },
    key: { type: String, required: true, immutable: true },
    fingerprint: { type: String, required: true, immutable: true },
    status: { type: String, enum: ["pending", "completed"], required: true },
    result: { type: String },
    expiresAt: { type: Date, required: true },
  },
  { collection: "idempotency_records" },
);

idempotencyRecordSchema.index({ scope: 1, subject: 1, key: 1 }, { unique: true });
idempotencyRecordSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type IdempotencyRecord = BaseDocumentFields & {
  scope: string;
  subject: string;
  key: string;
  fingerprint: string;
  status: "pending" | "completed";
  result?: string;
  expiresAt: Date;
};

export function getIdempotencyRecordModel(connection: Connection): Model<IdempotencyRecord> {
  return (
    (connection.models.IdempotencyRecord as Model<IdempotencyRecord> | undefined) ??
    connection.model<IdempotencyRecord>("IdempotencyRecord", idempotencyRecordSchema)
  );
}
