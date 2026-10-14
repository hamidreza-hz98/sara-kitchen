import "server-only";

import { Schema } from "mongoose";
import type { Connection, Model, Types } from "mongoose";

import { createBaseSchema, type BaseDocumentFields } from "@/server/database/schema";

export const PAYMENT_WEBHOOK_STATUSES = ["received", "applied", "ignored"] as const;
export const PAYMENT_WEBHOOK_IGNORE_REASONS = [
  "out-of-order",
  "duplicate-event",
  "invalid-amount",
  "invalid-history",
] as const;

export type PaymentWebhookStatus = (typeof PAYMENT_WEBHOOK_STATUSES)[number];
export type PaymentWebhookIgnoreReason = (typeof PAYMENT_WEBHOOK_IGNORE_REASONS)[number];

export type PaymentWebhookEventRecord = BaseDocumentFields & {
  provider: "mbway-sandbox";
  providerEventId: string;
  providerPaymentId: string;
  code: string;
  amountCents: number | null;
  responseCode: string | null;
  occurredAt: Date;
  status: PaymentWebhookStatus;
  transactionId: Types.ObjectId | null;
  ignoreReason: PaymentWebhookIgnoreReason | null;
  processedAt: Date | null;
};

const safeRef = /^(?!.*\d{12,})[A-Za-z0-9._:-]{1,128}$/u;

export const paymentWebhookEventSchema = createBaseSchema<PaymentWebhookEventRecord>(
  {
    provider: { type: String, enum: ["mbway-sandbox"], required: true, immutable: true },
    providerEventId: {
      type: String,
      required: true,
      immutable: true,
      validate: { validator: (value: string) => safeRef.test(value) },
    },
    providerPaymentId: {
      type: String,
      required: true,
      immutable: true,
      validate: { validator: (value: string) => safeRef.test(value) },
    },
    code: {
      type: String,
      required: true,
      immutable: true,
      enum: ["PENDING", "AUTHORIZED", "PAID", "FAILED", "CANCELLED", "EXPIRED", "REFUNDED"],
    },
    amountCents: {
      type: Number,
      default: null,
      immutable: true,
      validate: {
        validator: (value: number | null) =>
          value === null || (Number.isSafeInteger(value) && value >= 0),
      },
    },
    responseCode: {
      type: String,
      default: null,
      immutable: true,
      validate: {
        validator: (value: string | null) =>
          value === null || /^(?!.*\d{12,})[A-Z0-9_:-]{1,64}$/u.test(value),
      },
    },
    occurredAt: { type: Date, required: true, immutable: true },
    status: { type: String, enum: PAYMENT_WEBHOOK_STATUSES, default: "received", required: true },
    transactionId: { type: Schema.Types.ObjectId, ref: "Transaction", default: null },
    ignoreReason: { type: String, enum: PAYMENT_WEBHOOK_IGNORE_REASONS, default: null },
    processedAt: { type: Date, default: null },
  },
  { collection: "payment_webhook_events", schemaVersion: 1 },
);

paymentWebhookEventSchema.set("strict", "throw");
paymentWebhookEventSchema.index(
  { provider: 1, providerEventId: 1 },
  { unique: true, name: "payment_webhook_provider_event_unique" },
);
paymentWebhookEventSchema.index(
  { provider: 1, providerPaymentId: 1, status: 1, createdAt: 1 },
  { name: "payment_webhook_payment_pending" },
);
paymentWebhookEventSchema.index(
  { status: 1, createdAt: 1 },
  { name: "payment_webhook_recovery_queue" },
);

paymentWebhookEventSchema.pre("validate", function validateOutcome() {
  if (this.status === "received") {
    if (this.processedAt || this.transactionId || this.ignoreReason) {
      this.invalidate("status", "Received webhooks cannot have a processing outcome.");
    }
  } else if (
    !this.processedAt ||
    !this.transactionId ||
    (this.status === "ignored") !== Boolean(this.ignoreReason)
  ) {
    this.invalidate("status", "Processed webhooks require a coherent outcome.");
  }
});

export function getPaymentWebhookEventModel(
  connection: Connection,
): Model<PaymentWebhookEventRecord> {
  return (
    (connection.models.PaymentWebhookEvent as Model<PaymentWebhookEventRecord> | undefined) ??
    connection.model<PaymentWebhookEventRecord>("PaymentWebhookEvent", paymentWebhookEventSchema)
  );
}
