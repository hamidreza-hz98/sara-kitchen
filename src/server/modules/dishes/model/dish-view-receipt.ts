import "server-only";

import { Schema } from "mongoose";
import type { Connection, Model, Types } from "mongoose";

import { createBaseSchema, type BaseDocumentFields } from "@/server/database/schema";

export type DishViewReceiptRecord = BaseDocumentFields & {
  dishId: Types.ObjectId;
  visitorHash: string;
  windowStartedAt: Date;
  expiresAt: Date;
};

export const dishViewReceiptSchema = createBaseSchema<DishViewReceiptRecord>(
  {
    dishId: { type: Schema.Types.ObjectId, ref: "Dish", required: true, immutable: true },
    visitorHash: {
      type: String,
      required: true,
      immutable: true,
      select: false,
      match: /^[a-f\d]{64}$/u,
    },
    windowStartedAt: { type: Date, required: true, immutable: true },
    expiresAt: { type: Date, required: true, immutable: true },
  },
  { collection: "dish_view_receipts", schemaVersion: 1 },
);

dishViewReceiptSchema.index(
  { dishId: 1, visitorHash: 1, windowStartedAt: 1 },
  { unique: true, name: "dish_view_receipt_unique_window" },
);
dishViewReceiptSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, name: "dish_view_receipt_expiry_ttl" },
);

export function getDishViewReceiptModel(connection: Connection): Model<DishViewReceiptRecord> {
  return (
    (connection.models.DishViewReceipt as Model<DishViewReceiptRecord> | undefined) ??
    connection.model<DishViewReceiptRecord>("DishViewReceipt", dishViewReceiptSchema)
  );
}
