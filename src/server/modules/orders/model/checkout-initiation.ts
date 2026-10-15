import "server-only";

import { Schema } from "mongoose";
import type { Connection, Model, Types } from "mongoose";

import { createBaseSchema, type BaseDocumentFields } from "@/server/database/schema";

export type CheckoutInitiationRecord = BaseDocumentFields & {
  orderId: Types.ObjectId;
  transactionId: Types.ObjectId;
  state: "ready" | "in_flight" | "complete" | "needs_reconciliation";
  attemptedAt: Date | null;
  completedAt: Date | null;
};

const checkoutInitiationSchema = createBaseSchema<CheckoutInitiationRecord>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, immutable: true },
    transactionId: {
      type: Schema.Types.ObjectId,
      ref: "Transaction",
      required: true,
      immutable: true,
    },
    state: {
      type: String,
      enum: ["ready", "in_flight", "complete", "needs_reconciliation"],
      required: true,
      default: "ready",
    },
    attemptedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { collection: "checkout_initiations", schemaVersion: 1 },
);

checkoutInitiationSchema.index(
  { orderId: 1 },
  { unique: true, name: "checkout_initiation_one_per_order" },
);
checkoutInitiationSchema.index(
  { state: 1, attemptedAt: 1 },
  { name: "checkout_initiation_recovery" },
);

export function getCheckoutInitiationModel(
  connection: Connection,
): Model<CheckoutInitiationRecord> {
  return (
    (connection.models.CheckoutInitiation as Model<CheckoutInitiationRecord> | undefined) ??
    connection.model<CheckoutInitiationRecord>("CheckoutInitiation", checkoutInitiationSchema)
  );
}
