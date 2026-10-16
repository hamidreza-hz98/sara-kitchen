import "server-only";

import { Schema } from "mongoose";
import type { Connection, Model, Types } from "mongoose";

import { createBaseSchema, type BaseDocumentFields } from "@/server/database/schema";

export const PAYMENT_RECONCILIATION_STATES = [
  "pending",
  "in_flight",
  "resolved",
  "alerted",
] as const;

export type PaymentReconciliationState = (typeof PAYMENT_RECONCILIATION_STATES)[number];

export type PaymentReconciliationRecord = BaseDocumentFields & {
  transactionId: Types.ObjectId;
  provider: string;
  state: PaymentReconciliationState;
  attempts: number;
  nextAttemptAt: Date;
  leaseToken: string | null;
  lockedUntil: Date | null;
  lastAttemptAt: Date | null;
  resolvedAt: Date | null;
  alertedAt: Date | null;
  lastErrorCode: string | null;
};

const schema = createBaseSchema<PaymentReconciliationRecord>(
  {
    transactionId: {
      type: Schema.Types.ObjectId,
      ref: "Transaction",
      required: true,
      immutable: true,
    },
    provider: { type: String, required: true, immutable: true, maxlength: 64 },
    state: { type: String, enum: PAYMENT_RECONCILIATION_STATES, required: true },
    attempts: { type: Number, required: true, min: 0, max: 20, default: 0 },
    nextAttemptAt: { type: Date, required: true },
    leaseToken: { type: String, default: null, maxlength: 64 },
    lockedUntil: { type: Date, default: null },
    lastAttemptAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    alertedAt: { type: Date, default: null },
    lastErrorCode: { type: String, default: null, maxlength: 64 },
  },
  { collection: "payment_reconciliations", schemaVersion: 1 },
);

schema.index({ transactionId: 1 }, { unique: true, name: "reconciliation_transaction_unique" });
schema.index(
  { state: 1, nextAttemptAt: 1, lockedUntil: 1, _id: 1 },
  { name: "reconciliation_worker_queue" },
);
schema.index({ state: 1, alertedAt: -1 }, { name: "reconciliation_alerts" });

export function getPaymentReconciliationModel(
  connection: Connection,
): Model<PaymentReconciliationRecord> {
  return (
    (connection.models.PaymentReconciliation as Model<PaymentReconciliationRecord> | undefined) ??
    connection.model<PaymentReconciliationRecord>("PaymentReconciliation", schema)
  );
}
