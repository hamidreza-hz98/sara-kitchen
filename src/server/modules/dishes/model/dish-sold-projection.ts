import "server-only";

import { Schema } from "mongoose";
import type { Connection, Model, Types } from "mongoose";

import { createBaseSchema, type BaseDocumentFields } from "@/server/database/schema";

import {
  SOLD_COUNT_FULFILLMENT_STATES,
  SOLD_COUNT_PAYMENT_STATES,
  type SoldCountFulfillmentState,
  type SoldCountPaymentState,
} from "../policy/sold-count";

export type DishSoldContributionRecord = {
  dishId: Types.ObjectId;
  quantity: number;
};

export type DishSoldProjectionRecord = BaseDocumentFields & {
  orderId: Types.ObjectId;
  sourceRevision: number;
  sourceFingerprint: string;
  fulfillmentState: SoldCountFulfillmentState;
  paymentState: SoldCountPaymentState;
  contributions: DishSoldContributionRecord[];
};

const positiveSafeInteger = {
  validator: (value: number) => Number.isSafeInteger(value) && value > 0,
  message: "Value must be a positive safe integer.",
};

const contributionSchema = new Schema<DishSoldContributionRecord>(
  {
    dishId: { type: Schema.Types.ObjectId, ref: "Dish", required: true },
    quantity: { type: Number, required: true, validate: positiveSafeInteger },
  },
  { _id: false, id: false },
);

export const dishSoldProjectionSchema = createBaseSchema<DishSoldProjectionRecord>(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      required: true,
      immutable: true,
      unique: true,
      index: true,
    },
    sourceRevision: { type: Number, required: true, validate: positiveSafeInteger },
    sourceFingerprint: {
      type: String,
      required: true,
      select: false,
      match: /^[a-f\d]{64}$/u,
    },
    fulfillmentState: { type: String, enum: SOLD_COUNT_FULFILLMENT_STATES, required: true },
    paymentState: { type: String, enum: SOLD_COUNT_PAYMENT_STATES, required: true },
    contributions: {
      type: [contributionSchema],
      required: true,
      default: [],
      validate: {
        validator: (values: DishSoldContributionRecord[]) =>
          new Set(values.map(({ dishId }) => dishId.toHexString())).size === values.length,
        message: "Sold-count contributions must contain unique Dish references.",
      },
    },
  },
  { collection: "dish_sold_projections", schemaVersion: 1 },
);

export function getDishSoldProjectionModel(
  connection: Connection,
): Model<DishSoldProjectionRecord> {
  return (
    (connection.models.DishSoldProjection as Model<DishSoldProjectionRecord> | undefined) ??
    connection.model<DishSoldProjectionRecord>("DishSoldProjection", dishSoldProjectionSchema)
  );
}
