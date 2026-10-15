import "server-only";

import { isValidObjectId, Schema } from "mongoose";
import type { Connection, Model, Types } from "mongoose";

import { SUPPORTED_LOCALES, type SupportedLocale } from "@/constants";
import { createBaseSchema, type BaseDocumentFields } from "@/server/database/schema";
import { TRANSACTION_STATUSES, type TransactionStatus } from "@/server/modules/transactions";

import { generateOrderCode, ORDER_CODE_PATTERN } from "../policy/order-code";
import {
  validateInitialOrderState,
  validateOrderTransitionEvidence,
} from "../policy/order-state-machine";

export const ORDER_STATUSES = [
  "pending_payment",
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
  "completed",
  "payment_failed",
  "cancelled",
  "expired",
  "refunded",
] as const;
export const ORDER_MAX_MONEY_CENTS = 100_000_000;
export const ORDER_MAX_LINES = 100;
export const ORDER_MAX_HISTORY = 200;
export const ORDER_SNAPSHOT_IMMUTABLE_ERROR = "Order purchase snapshots are immutable.";
export const ORDER_HISTORY_APPEND_ONLY_ERROR =
  "Order history and transaction references are append-only.";
export const ORDER_INDEX_NAMES = Object.freeze({
  code: "order_code_unique",
  timeline: "order_timeline",
  customer: "order_customer_timeline",
  status: "order_status_timeline",
  transaction: "order_transaction_lookup",
} as const);

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type OrderFulfillmentMethod = "pickup" | "delivery";
export type OrderDiscountType = "none" | "fixed" | "percentage";

export type OrderItemSnapshot = {
  dishId: Types.ObjectId;
  slug: string;
  name: string;
  portionAmount: number;
  portionUnit: "serving" | "piece" | "gram" | "millilitre";
  quantity: number;
  leadTimeMinutes: number;
  baseUnitPriceCents: number;
  effectiveUnitPriceCents: number;
  unitDiscountCents: number;
  lineBaseSubtotalCents: number;
  lineDiscountCents: number;
  lineSubtotalCents: number;
  discount: {
    type: OrderDiscountType;
    amountCents: number | null;
    basisPoints: number | null;
  };
};

export type OrderCustomerSnapshot = {
  firstName: string;
  lastName: string;
  mobile: string;
  email: string | null;
};

export type OrderAddressSnapshot = {
  name: string;
  recipientName: string;
  recipientMobile: string;
  formattedAddress: string;
  postalCode: string;
  location: { type: "Point"; coordinates: [longitude: number, latitude: number] };
  deliveryNotes: string | null;
};

export type OrderPricingSnapshot = {
  subtotalCents: number;
  discountCents: number;
  deliveryFeeCents: number;
  taxCents: number;
  adjustmentsCents: number;
  totalCents: number;
  taxPolicy: "disabled_mvp";
  calculatedAt: Date;
  adjustments: { code: string; amountCents: number }[];
  delivery: {
    distanceMeters: number | null;
    baseFeeCents: number;
    freeDeliveryApplied: boolean;
  };
};

export type OrderFulfillmentSnapshot = {
  method: OrderFulfillmentMethod;
  acceptedAt: Date;
  leadTimeMinutes: number;
  earliestReadyAt: Date;
  completedAt: Date | null;
};

export type OrderStatusEvent = {
  eventKey: string;
  status: OrderStatus;
  actorKind: "system" | "admin" | "customer";
  actorId: Types.ObjectId | null;
  reasonCode: string | null;
  paymentStatus: TransactionStatus;
  occurredAt: Date;
  recordedAt: Date;
};

export type OrderRecord = BaseDocumentFields & {
  code: string;
  status: OrderStatus;
  statusHistory: OrderStatusEvent[];
  revision: number;
  managementRevision: number;
  customerId: Types.ObjectId;
  customerSnapshot: OrderCustomerSnapshot;
  addressId: Types.ObjectId | null;
  addressSnapshot: OrderAddressSnapshot | null;
  items: OrderItemSnapshot[];
  transactionIds: Types.ObjectId[];
  notes: string | null;
  internalNote: string | null;
  refundFollowUpRequired: boolean;
  currency: "EUR";
  locale: SupportedLocale;
  pricing: OrderPricingSnapshot;
  fulfillment: OrderFulfillmentSnapshot;
};

const cents = (min = 0) => ({
  type: Number,
  required: true,
  validate: {
    validator: (value: number) =>
      Number.isSafeInteger(value) && value >= min && value <= ORDER_MAX_MONEY_CENTS,
    message: "Money must be bounded integer EUR cents.",
  },
});
const boundedInt = (min: number, max: number) => ({
  type: Number,
  required: true,
  validate: {
    validator: (value: number) => Number.isSafeInteger(value) && value >= min && value <= max,
  },
});
const ref = (name: string, required = true) => ({
  type: Schema.Types.ObjectId,
  ref: name,
  required,
  ...(!required ? { default: null } : {}),
  validate: {
    validator: (value: Types.ObjectId | null) =>
      value === null ? !required : isValidObjectId(value),
  },
});
const text = (max: number) => ({
  type: String,
  required: true,
  trim: true,
  minlength: 1,
  maxlength: max,
});
const note = (max: number) => ({ type: String, default: null, trim: true, maxlength: max });

const discountSchema = new Schema<OrderItemSnapshot["discount"]>(
  {
    type: { type: String, enum: ["none", "fixed", "percentage"], required: true },
    amountCents: {
      type: Number,
      default: null,
      validate: {
        validator: (v: number | null) =>
          v === null || (Number.isSafeInteger(v) && v >= 0 && v <= ORDER_MAX_MONEY_CENTS),
      },
    },
    basisPoints: {
      type: Number,
      default: null,
      validate: {
        validator: (v: number | null) =>
          v === null || (Number.isSafeInteger(v) && v >= 0 && v <= 10_000),
      },
    },
  },
  { _id: false, id: false, strict: "throw" },
);

const itemSchema = new Schema<OrderItemSnapshot>(
  {
    dishId: ref("Dish"),
    slug: text(180),
    name: text(200),
    portionAmount: { type: Number, required: true, min: 0.001, max: 1_000_000 },
    portionUnit: { type: String, enum: ["serving", "piece", "gram", "millilitre"], required: true },
    quantity: boundedInt(1, 99),
    leadTimeMinutes: boundedInt(0, 10_080),
    baseUnitPriceCents: cents(),
    effectiveUnitPriceCents: cents(),
    unitDiscountCents: cents(),
    lineBaseSubtotalCents: cents(),
    lineDiscountCents: cents(),
    lineSubtotalCents: cents(),
    discount: { type: discountSchema, required: true },
  },
  { _id: false, id: false, strict: "throw" },
);

const customerSnapshotSchema = new Schema<OrderCustomerSnapshot>(
  {
    firstName: text(120),
    lastName: text(120),
    mobile: { ...text(32), match: /^\+[1-9]\d{7,14}$/u },
    email: {
      type: String,
      default: null,
      trim: true,
      lowercase: true,
      maxlength: 254,
      validate: {
        validator: (v: string | null) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(v),
      },
    },
  },
  { _id: false, id: false, strict: "throw" },
);

const locationSchema = new Schema<OrderAddressSnapshot["location"]>(
  {
    type: { type: String, enum: ["Point"], required: true },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: (v: number[]) =>
          v.length === 2 &&
          Number.isFinite(v[0]) &&
          Number.isFinite(v[1]) &&
          v[0]! >= -180 &&
          v[0]! <= 180 &&
          v[1]! >= -90 &&
          v[1]! <= 90,
      },
    },
  },
  { _id: false, id: false, strict: "throw" },
);

const addressSnapshotSchema = new Schema<OrderAddressSnapshot>(
  {
    name: text(80),
    recipientName: text(160),
    recipientMobile: { ...text(32), match: /^\+[1-9]\d{7,14}$/u },
    formattedAddress: text(500),
    postalCode: { ...text(16), match: /^\d{4}-\d{3}$/u },
    location: { type: locationSchema, required: true },
    deliveryNotes: note(500),
  },
  { _id: false, id: false, strict: "throw" },
);

const adjustmentSchema = new Schema<OrderPricingSnapshot["adjustments"][number]>(
  {
    code: { type: String, required: true, match: /^[a-z][a-z0-9._-]{1,63}$/u },
    amountCents: {
      type: Number,
      required: true,
      validate: {
        validator: (v: number) => Number.isSafeInteger(v) && Math.abs(v) <= ORDER_MAX_MONEY_CENTS,
      },
    },
  },
  { _id: false, id: false, strict: "throw" },
);

const deliveryPricingSchema = new Schema<OrderPricingSnapshot["delivery"]>(
  {
    distanceMeters: {
      type: Number,
      default: null,
      validate: {
        validator: (v: number | null) =>
          v === null || (Number.isSafeInteger(v) && v >= 0 && v <= 100_000),
      },
    },
    baseFeeCents: cents(),
    freeDeliveryApplied: { type: Boolean, required: true },
  },
  { _id: false, id: false, strict: "throw" },
);

const pricingSchema = new Schema<OrderPricingSnapshot>(
  {
    subtotalCents: cents(),
    discountCents: cents(),
    deliveryFeeCents: cents(),
    taxCents: cents(),
    adjustmentsCents: {
      type: Number,
      required: true,
      validate: {
        validator: (v: number) => Number.isSafeInteger(v) && Math.abs(v) <= ORDER_MAX_MONEY_CENTS,
      },
    },
    totalCents: cents(),
    taxPolicy: { type: String, enum: ["disabled_mvp"], required: true },
    calculatedAt: { type: Date, required: true },
    adjustments: { type: [adjustmentSchema], default: [] },
    delivery: { type: deliveryPricingSchema, required: true },
  },
  { _id: false, id: false, strict: "throw" },
);

const fulfillmentSchema = new Schema<OrderFulfillmentSnapshot>(
  {
    method: { type: String, enum: ["pickup", "delivery"], required: true },
    acceptedAt: { type: Date, required: true },
    leadTimeMinutes: boundedInt(0, 10_080),
    earliestReadyAt: { type: Date, required: true },
    completedAt: { type: Date, default: null },
  },
  { _id: false, id: false, strict: "throw" },
);

const statusEventSchema = new Schema<OrderStatusEvent>(
  {
    eventKey: { type: String, required: true, match: /^[A-Za-z0-9._:-]{1,128}$/u },
    status: { type: String, enum: ORDER_STATUSES, required: true },
    actorKind: { type: String, enum: ["system", "admin", "customer"], required: true },
    actorId: {
      type: Schema.Types.ObjectId,
      default: null,
      validate: { validator: (v: Types.ObjectId | null) => v === null || isValidObjectId(v) },
    },
    reasonCode: { type: String, default: null, match: /^[a-z][a-z0-9._-]{1,63}$/u },
    paymentStatus: { type: String, enum: TRANSACTION_STATUSES, required: true },
    occurredAt: { type: Date, required: true },
    recordedAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false, id: false, strict: "throw" },
);

export const orderSchema = createBaseSchema<OrderRecord>(
  {
    code: {
      type: String,
      required: true,
      immutable: true,
      default: generateOrderCode,
      match: ORDER_CODE_PATTERN,
    },
    status: { type: String, enum: ORDER_STATUSES, required: true },
    statusHistory: { type: [statusEventSchema], required: true },
    revision: boundedInt(1, ORDER_MAX_HISTORY),
    managementRevision: { type: Number, required: true, default: 0, min: 0, max: 10_000 },
    customerId: { ...ref("Customer"), immutable: true },
    customerSnapshot: { type: customerSnapshotSchema, required: true },
    addressId: ref("Address", false),
    addressSnapshot: { type: addressSnapshotSchema, default: null },
    items: { type: [itemSchema], required: true },
    transactionIds: { type: [Schema.Types.ObjectId], ref: "Transaction", default: [] },
    notes: note(1_000),
    internalNote: note(1_000),
    refundFollowUpRequired: { type: Boolean, required: true, default: false },
    currency: { type: String, enum: ["EUR"], required: true, immutable: true },
    locale: { type: String, enum: SUPPORTED_LOCALES, required: true, immutable: true },
    pricing: { type: pricingSchema, required: true },
    fulfillment: { type: fulfillmentSchema, required: true },
  },
  { collection: "orders", schemaVersion: 1 },
);

orderSchema.set("strict", "throw");

const SNAPSHOT_PATHS = [
  "code",
  "customerId",
  "customerSnapshot",
  "addressId",
  "addressSnapshot",
  "items",
  "notes",
  "currency",
  "locale",
  "pricing",
  "fulfillment.method",
  "fulfillment.acceptedAt",
  "fulfillment.leadTimeMinutes",
  "fulfillment.earliestReadyAt",
] as const;
function persistedShape(document: {
  toObject: (options: Record<string, unknown>) => Record<string, unknown>;
}) {
  return document.toObject({ depopulate: true, transform: false, virtuals: false });
}
function atPath(value: Record<string, unknown>, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (current, key) =>
        current && typeof current === "object"
          ? (current as Record<string, unknown>)[key]
          : undefined,
      value,
    );
}
function snapshotFingerprint(document: Parameters<typeof persistedShape>[0]): string {
  const value = persistedShape(document);
  return JSON.stringify(SNAPSHOT_PATHS.map((path) => atPath(value, path)));
}
function historyFingerprint(document: Parameters<typeof persistedShape>[0]): string[] {
  const value = persistedShape(document);
  return ((value.statusHistory as unknown[]) ?? []).map((event) => JSON.stringify(event));
}
function transactionFingerprint(document: Parameters<typeof persistedShape>[0]): string[] {
  const value = persistedShape(document);
  return ((value.transactionIds as unknown[]) ?? []).map((id) => JSON.stringify(id));
}
function rememberSaved(
  document: { $locals: Record<string, unknown> } & Parameters<typeof persistedShape>[0],
) {
  document.$locals.orderSnapshotFingerprint = snapshotFingerprint(document);
  document.$locals.orderHistoryFingerprints = historyFingerprint(document);
  document.$locals.orderTransactionFingerprints = transactionFingerprint(document);
}
function savedPrefixChanged(current: string[], saved: string[]): boolean {
  return current.length < saved.length || saved.some((value, index) => current[index] !== value);
}
function immutableError(
  document: { isNew: boolean; $locals: Record<string, unknown> } & Parameters<
    typeof persistedShape
  >[0],
): string | null {
  if (document.isNew) return null;
  if (document.$locals.orderSnapshotFingerprint !== snapshotFingerprint(document))
    return ORDER_SNAPSHOT_IMMUTABLE_ERROR;
  const history = document.$locals.orderHistoryFingerprints as string[] | undefined;
  const transactions = document.$locals.orderTransactionFingerprints as string[] | undefined;
  if (
    !history ||
    !transactions ||
    savedPrefixChanged(historyFingerprint(document), history) ||
    savedPrefixChanged(transactionFingerprint(document), transactions)
  )
    return ORDER_HISTORY_APPEND_ONLY_ERROR;
  return null;
}

function percentageUnitDiscount(baseCents: number, basisPoints: number | null): number | null {
  if (
    !Number.isSafeInteger(baseCents) ||
    !Number.isSafeInteger(basisPoints) ||
    basisPoints === null ||
    basisPoints < 1 ||
    basisPoints > 10_000
  )
    return null;
  return Number((BigInt(baseCents) * BigInt(basisPoints) + BigInt(5_000)) / BigInt(10_000));
}

function checkInvariants(document: OrderRecord): string[] {
  const errors: string[] = [];
  const items = document.items ?? [];
  if (items.length < 1 || items.length > ORDER_MAX_LINES)
    errors.push("Order requires 1 to 100 lines.");
  const dishIds = items.map((item) => item.dishId?.toString());
  if (new Set(dishIds).size !== dishIds.length) errors.push("Order dish IDs must be unique.");
  for (const item of items) {
    if (
      item.baseUnitPriceCents !== item.effectiveUnitPriceCents + item.unitDiscountCents ||
      item.lineBaseSubtotalCents !== item.baseUnitPriceCents * item.quantity ||
      item.lineDiscountCents !== item.unitDiscountCents * item.quantity ||
      item.lineSubtotalCents !== item.effectiveUnitPriceCents * item.quantity
    ) {
      errors.push("Order line prices do not reconcile.");
    }
    if (
      !item.discount ||
      (item.discount.type === "none" &&
        (item.discount.amountCents !== null ||
          item.discount.basisPoints !== null ||
          item.unitDiscountCents !== 0)) ||
      (item.discount.type === "fixed" &&
        (item.discount.amountCents === null ||
          item.discount.amountCents < 1 ||
          item.discount.amountCents !== item.unitDiscountCents ||
          item.discount.basisPoints !== null)) ||
      (item.discount.type === "percentage" &&
        (item.discount.basisPoints === null ||
          item.discount.amountCents !== null ||
          item.unitDiscountCents !==
            percentageUnitDiscount(item.baseUnitPriceCents, item.discount.basisPoints)))
    ) {
      errors.push("Order line discount definition is inconsistent.");
    }
  }
  const pricing = document.pricing;
  if (pricing?.delivery) {
    if (
      pricing.subtotalCents !== items.reduce((sum, item) => sum + item.lineBaseSubtotalCents, 0) ||
      pricing.discountCents !== items.reduce((sum, item) => sum + item.lineDiscountCents, 0) ||
      pricing.adjustmentsCents !==
        pricing.adjustments.reduce((sum, adjustment) => sum + adjustment.amountCents, 0) ||
      pricing.totalCents !==
        pricing.subtotalCents -
          pricing.discountCents +
          pricing.deliveryFeeCents +
          pricing.taxCents +
          pricing.adjustmentsCents ||
      pricing.taxCents !== 0 ||
      pricing.deliveryFeeCents > pricing.delivery.baseFeeCents ||
      (pricing.delivery.freeDeliveryApplied &&
        (pricing.subtotalCents - pricing.discountCents < 20_000 || pricing.deliveryFeeCents !== 0))
    ) {
      errors.push("Order pricing does not reconcile.");
    }
    if (
      new Set(pricing.adjustments.map((adjustment) => adjustment.code)).size !==
      pricing.adjustments.length
    )
      errors.push("Order adjustment codes must be unique.");
  }
  const fulfillment = document.fulfillment;
  if (fulfillment?.acceptedAt instanceof Date && fulfillment.earliestReadyAt instanceof Date) {
    if (
      fulfillment.leadTimeMinutes !== Math.max(0, ...items.map((item) => item.leadTimeMinutes)) ||
      fulfillment.earliestReadyAt.getTime() !==
        fulfillment.acceptedAt.getTime() + fulfillment.leadTimeMinutes * 60_000
    ) {
      errors.push("Order readiness timing does not match the line lead times.");
    }
    if (fulfillment.completedAt && fulfillment.completedAt < fulfillment.acceptedAt)
      errors.push("Completion cannot precede acceptance.");
    if (fulfillment.method === "pickup") {
      if (
        document.addressId ||
        document.addressSnapshot ||
        pricing?.deliveryFeeCents !== 0 ||
        pricing?.delivery?.baseFeeCents !== 0 ||
        pricing?.delivery?.distanceMeters !== null ||
        pricing?.delivery?.freeDeliveryApplied
      ) {
        errors.push("Pickup must not contain delivery address or fees.");
      }
    } else if (
      !document.addressId ||
      !document.addressSnapshot ||
      pricing?.delivery?.distanceMeters == null
    ) {
      errors.push("Delivery requires its address and distance snapshots.");
    } else if (
      pricing &&
      pricing.subtotalCents - pricing.discountCents >= 20_000 &&
      (pricing.deliveryFeeCents !== 0 || !pricing.delivery.freeDeliveryApplied)
    ) {
      errors.push("Delivery must be free above the EUR 200 merchandise threshold.");
    }
  }
  const history = document.statusHistory ?? [];
  if (
    history.length < 1 ||
    history.length > ORDER_MAX_HISTORY ||
    document.revision !== history.length ||
    history.at(-1)?.status !== document.status ||
    new Set(history.map((event) => event.eventKey)).size !== history.length
  ) {
    errors.push("Order status/history revision is inconsistent.");
  }
  if (history.length > 0 && fulfillment) {
    try {
      validateInitialOrderState({
        status: history[0]!.status,
        actorKind: history[0]!.actorKind,
        paymentStatus: history[0]!.paymentStatus,
      });
      for (let index = 1; index < history.length; index += 1) {
        const previous = history[index - 1]!;
        const current = history[index]!;
        validateOrderTransitionEvidence({
          from: previous.status,
          to: current.status,
          method: fulfillment.method,
          paymentStatus: current.paymentStatus,
          priorPaymentStatus: previous.paymentStatus,
          actorKind: current.actorKind,
          reasonCode: current.reasonCode,
        });
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Invalid order transition history.");
    }
  }
  if (
    fulfillment &&
    Boolean(fulfillment.completedAt) !== history.some((event) => event.status === "completed")
  ) {
    errors.push("Completion time must match a completed lifecycle event.");
  }
  if (history.some((event) => (event.actorKind === "system") !== (event.actorId === null))) {
    errors.push("Order status event actor is invalid.");
  }
  const transactionIds = document.transactionIds ?? [];
  if (new Set(transactionIds.map((id) => id?.toString())).size !== transactionIds.length)
    errors.push("Order transaction references must be unique.");
  if (
    transactionIds.length < 1 ||
    transactionIds.length > 20 ||
    transactionIds.some((id) => !isValidObjectId(id))
  )
    errors.push("Order needs 1 to 20 transaction references.");
  return errors;
}

orderSchema.post("init", rememberSaved);
orderSchema.post("save", rememberSaved);
orderSchema.pre("validate", function validateOrder() {
  for (const error of checkInvariants(this)) this.invalidate("statusHistory", error);
  const error = immutableError(this);
  if (error) this.invalidate("items", error);
});
orderSchema.pre("save", function rejectUnsafeSave() {
  const error = immutableError(this) ?? checkInvariants(this)[0];
  if (error) throw new Error(error);
});
for (const operation of [
  "updateOne",
  "updateMany",
  "replaceOne",
  "findOneAndUpdate",
  "findOneAndReplace",
  "deleteOne",
  "deleteMany",
  "findOneAndDelete",
] as const) {
  orderSchema.pre(operation, function rejectQueryMutation() {
    throw new Error(ORDER_SNAPSHOT_IMMUTABLE_ERROR);
  });
}
orderSchema.pre("deleteOne", { document: true, query: false }, function rejectDelete() {
  throw new Error(ORDER_SNAPSHOT_IMMUTABLE_ERROR);
});
orderSchema.pre("bulkWrite", function rejectBulkMutation() {
  throw new Error(ORDER_SNAPSHOT_IMMUTABLE_ERROR);
});

orderSchema.index({ code: 1 }, { name: ORDER_INDEX_NAMES.code, unique: true });
orderSchema.index({ createdAt: -1, _id: -1 }, { name: ORDER_INDEX_NAMES.timeline });
orderSchema.index({ customerId: 1, createdAt: -1, _id: -1 }, { name: ORDER_INDEX_NAMES.customer });
orderSchema.index({ status: 1, createdAt: -1, _id: -1 }, { name: ORDER_INDEX_NAMES.status });
orderSchema.index({ transactionIds: 1 }, { name: ORDER_INDEX_NAMES.transaction });

export function getOrderModel(connection: Connection): Model<OrderRecord> {
  return (
    (connection.models.Order as Model<OrderRecord> | undefined) ??
    connection.model<OrderRecord>("Order", orderSchema)
  );
}
