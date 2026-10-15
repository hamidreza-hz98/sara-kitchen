import "server-only";

import { Schema } from "mongoose";
import type { Connection, Model, Types } from "mongoose";

import { SUPPORTED_LOCALES, type SupportedLocale } from "@/constants";
import { createBaseSchema, type BaseDocumentFields } from "@/server/database/schema";

import type { OrderNotificationIntent } from "../policy/order-state-machine";

export type OrderNotificationRecord = BaseDocumentFields & {
  orderId: Types.ObjectId;
  customerId: Types.ObjectId;
  orderCode: string;
  eventKey: string;
  intent: OrderNotificationIntent;
  channel: "in_app" | "whatsapp";
  locale: SupportedLocale;
  title: string;
  body: string;
  state: "pending" | "in_flight" | "delivered" | "dead";
  attempts: number;
  nextAttemptAt: Date;
  lockedUntil: Date | null;
  leaseToken: string | null;
  deliveredAt: Date | null;
  providerMessageId: string | null;
  lastErrorCode: string | null;
};

const notificationSchema = createBaseSchema<OrderNotificationRecord>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, immutable: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, immutable: true },
    orderCode: { type: String, required: true, maxlength: 40, immutable: true },
    eventKey: { type: String, required: true, maxlength: 128, immutable: true },
    intent: { type: String, required: true, immutable: true },
    channel: { type: String, enum: ["in_app", "whatsapp"], required: true, immutable: true },
    locale: { type: String, enum: SUPPORTED_LOCALES, required: true, immutable: true },
    title: { type: String, required: true, maxlength: 160, immutable: true },
    body: { type: String, required: true, maxlength: 1000, immutable: true },
    state: {
      type: String,
      enum: ["pending", "in_flight", "delivered", "dead"],
      required: true,
      default: "pending",
    },
    attempts: { type: Number, required: true, default: 0, min: 0, max: 10 },
    nextAttemptAt: { type: Date, required: true, default: Date.now },
    lockedUntil: { type: Date, default: null },
    leaseToken: { type: String, default: null, maxlength: 64 },
    deliveredAt: { type: Date, default: null },
    providerMessageId: { type: String, maxlength: 128, default: null },
    lastErrorCode: { type: String, maxlength: 64, default: null },
  },
  { collection: "order_notifications", schemaVersion: 1 },
);

notificationSchema.index(
  { eventKey: 1, intent: 1 },
  { unique: true, name: "notification_event_intent_unique" },
);
notificationSchema.index(
  { state: 1, nextAttemptAt: 1, lockedUntil: 1 },
  { name: "notification_dispatch_due" },
);
notificationSchema.index(
  { customerId: 1, createdAt: -1, _id: -1 },
  { name: "notification_customer_inbox" },
);

export function getOrderNotificationModel(connection: Connection): Model<OrderNotificationRecord> {
  return (
    (connection.models.OrderNotification as Model<OrderNotificationRecord> | undefined) ??
    connection.model<OrderNotificationRecord>("OrderNotification", notificationSchema)
  );
}
