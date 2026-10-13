import "server-only";

import { isValidObjectId, Schema } from "mongoose";
import type { Connection, Model, Types } from "mongoose";

import { createBaseSchema, type BaseDocumentFields } from "@/server/database/schema";

export const CART_STATUSES = ["active", "merged", "converted", "expired"] as const;
export const CART_TERMINAL_STATUSES = ["merged", "converted", "expired"] as const;
export const CART_CURRENCY = "EUR" as const;
export const CART_GUEST_TOKEN_HASH_PATTERN = /^[a-f0-9]{64}$/u;
export const CART_MAX_DISTINCT_LINES = 100;
export const CART_MAX_QUANTITY_PER_LINE = 99;
export const CART_MAX_MONEY_CENTS = 100_000_000;
export const CART_MAX_NOTES_LENGTH = 1_000;

export const CART_INDEX_NAMES = Object.freeze({
  activeCustomer: "cart_one_active_per_customer",
  activeGuest: "cart_one_active_per_guest",
  customerTimeline: "cart_customer_timeline",
  expirySweep: "cart_active_expiry_sweep",
  terminalPurge: "cart_terminal_purge_ttl",
} as const);

export type CartStatus = (typeof CART_STATUSES)[number];

export type CartLine = {
  dishId: Types.ObjectId;
  quantity: number;
};

export type CartPricingSummary = {
  adjustmentsCents: number;
  calculatedAt: Date | null;
  deliveryFeeCents: number;
  discountCents: number;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
};

export type CartRecord = BaseDocumentFields & {
  absoluteExpiresAt: Date | null;
  currency: typeof CART_CURRENCY;
  customerId: Types.ObjectId | null;
  expiresAt: Date;
  guestTokenHash: string | null;
  lines: CartLine[];
  mergedIntoCartId: Types.ObjectId | null;
  notes: string | null;
  pricing: CartPricingSummary;
  purgeAt: Date | null;
  selectedAddressId: Types.ObjectId | null;
  status: CartStatus;
  version: number;
};

const safeInteger = (minimum: number, maximum: number) => ({
  validator: (value: number) => Number.isSafeInteger(value) && value >= minimum && value <= maximum,
  message: `Value must be a safe integer from ${minimum} through ${maximum}.`,
});

const optionalObjectId = (ref: string) => ({
  type: Schema.Types.ObjectId,
  ref,
  default: null,
  validate: {
    validator: (value: Types.ObjectId | null) => value === null || isValidObjectId(value),
    message: `Reference to ${ref} must be a valid ObjectId.`,
  },
});

const lineSchema = new Schema<CartLine>(
  {
    dishId: {
      type: Schema.Types.ObjectId,
      ref: "Dish",
      required: true,
      validate: {
        validator: isValidObjectId,
        message: "Cart line dish must be a valid Dish ObjectId.",
      },
    },
    quantity: {
      type: Number,
      required: true,
      validate: safeInteger(1, CART_MAX_QUANTITY_PER_LINE),
    },
  },
  { _id: false, id: false },
);

const pricingSummarySchema = new Schema<CartPricingSummary>(
  {
    subtotalCents: {
      type: Number,
      required: true,
      default: 0,
      validate: safeInteger(0, CART_MAX_MONEY_CENTS),
    },
    discountCents: {
      type: Number,
      required: true,
      default: 0,
      validate: safeInteger(0, CART_MAX_MONEY_CENTS),
    },
    deliveryFeeCents: {
      type: Number,
      required: true,
      default: 0,
      validate: safeInteger(0, CART_MAX_MONEY_CENTS),
    },
    taxCents: {
      type: Number,
      required: true,
      default: 0,
      validate: safeInteger(0, CART_MAX_MONEY_CENTS),
    },
    adjustmentsCents: {
      type: Number,
      required: true,
      default: 0,
      validate: safeInteger(-CART_MAX_MONEY_CENTS, CART_MAX_MONEY_CENTS),
    },
    totalCents: {
      type: Number,
      required: true,
      default: 0,
      validate: safeInteger(0, CART_MAX_MONEY_CENTS),
    },
    calculatedAt: { type: Date, default: null },
  },
  { _id: false, id: false },
);

export const cartSchema = createBaseSchema<CartRecord>(
  {
    status: { type: String, enum: CART_STATUSES, required: true, default: "active" },
    customerId: {
      ...optionalObjectId("Customer"),
      immutable: true,
    },
    guestTokenHash: {
      type: String,
      default: null,
      immutable: true,
      select: false,
      validate: {
        validator: (value: string | null) =>
          value === null || CART_GUEST_TOKEN_HASH_PATTERN.test(value),
        message: "Guest cart identity must be a SHA-256 token digest.",
      },
    },
    lines: {
      type: [lineSchema],
      default: [],
      validate: [
        {
          validator: (values: CartLine[]) => values.length <= CART_MAX_DISTINCT_LINES,
          message: `A cart cannot contain more than ${CART_MAX_DISTINCT_LINES} distinct lines.`,
        },
        {
          validator: (values: CartLine[]) =>
            new Set(values.map((line) => line.dishId.toHexString())).size === values.length,
          message: "Cart dish references must be unique.",
        },
      ],
    },
    selectedAddressId: optionalObjectId("Address"),
    notes: { type: String, trim: true, maxlength: CART_MAX_NOTES_LENGTH, default: null },
    pricing: { type: pricingSummarySchema, required: true, default: () => ({}) },
    currency: {
      type: String,
      enum: [CART_CURRENCY],
      required: true,
      default: CART_CURRENCY,
      immutable: true,
    },
    version: { type: Number, required: true, default: 1, validate: safeInteger(1, 2_147_483_647) },
    expiresAt: { type: Date, required: true },
    absoluteExpiresAt: { type: Date, default: null },
    purgeAt: { type: Date, default: null },
    mergedIntoCartId: optionalObjectId("Cart"),
  },
  { collection: "carts", schemaVersion: 1 },
);

cartSchema.pre("validate", function validateCartInvariants() {
  const isGuest = Boolean(this.guestTokenHash);
  const isCustomer = Boolean(this.customerId);
  if (isGuest === isCustomer) {
    this.invalidate("customerId", "A cart requires exactly one guest or customer identity.");
  }

  if (isGuest) {
    if (!(this.absoluteExpiresAt instanceof Date)) {
      this.invalidate("absoluteExpiresAt", "Guest carts require an absolute expiry.");
    } else if (this.expiresAt && this.expiresAt > this.absoluteExpiresAt) {
      this.invalidate("expiresAt", "Guest idle expiry cannot exceed absolute expiry.");
    }
    if (this.selectedAddressId) {
      this.invalidate("selectedAddressId", "Guest carts cannot select a customer address.");
    }
  } else if (this.absoluteExpiresAt !== null) {
    this.invalidate("absoluteExpiresAt", "Customer carts cannot contain a guest absolute expiry.");
  }

  const isTerminal = (CART_TERMINAL_STATUSES as readonly string[]).includes(this.status);
  if (isTerminal !== this.purgeAt instanceof Date) {
    this.invalidate(
      "purgeAt",
      isTerminal
        ? "Terminal carts require an explicit purge timestamp."
        : "Active carts cannot have a TTL purge timestamp.",
    );
  }

  if (this.status === "merged") {
    if (!isGuest || !this.mergedIntoCartId) {
      this.invalidate("mergedIntoCartId", "Merged guest carts require a target customer cart.");
    }
  } else if (this.mergedIntoCartId) {
    this.invalidate("mergedIntoCartId", "Only merged carts can reference a merge target.");
  }
  if (this.mergedIntoCartId?.equals(this._id)) {
    this.invalidate("mergedIntoCartId", "A cart cannot merge into itself.");
  }
  if (this.status === "converted" && !isCustomer) {
    this.invalidate("status", "Only a customer cart can be converted at checkout.");
  }

  const pricing = this.pricing;
  if (pricing) {
    if (pricing.discountCents > pricing.subtotalCents) {
      this.invalidate("pricing.discountCents", "Cart discount cannot exceed subtotal.");
    }
    const expectedTotal =
      pricing.subtotalCents -
      pricing.discountCents +
      pricing.deliveryFeeCents +
      pricing.taxCents +
      pricing.adjustmentsCents;
    if (!Number.isSafeInteger(expectedTotal) || expectedTotal !== pricing.totalCents) {
      this.invalidate("pricing.totalCents", "Cart pricing components must equal the total.");
    }
    if (this.lines.length > 0 && !(pricing.calculatedAt instanceof Date)) {
      this.invalidate("pricing.calculatedAt", "A non-empty cart requires calculated pricing.");
    }
  }
});

cartSchema.index(
  { customerId: 1 },
  {
    name: CART_INDEX_NAMES.activeCustomer,
    unique: true,
    partialFilterExpression: { status: "active", customerId: { $type: "objectId" } },
  },
);
cartSchema.index(
  { guestTokenHash: 1 },
  {
    name: CART_INDEX_NAMES.activeGuest,
    unique: true,
    partialFilterExpression: { status: "active", guestTokenHash: { $type: "string" } },
  },
);
cartSchema.index(
  { customerId: 1, status: 1, updatedAt: -1, _id: -1 },
  { name: CART_INDEX_NAMES.customerTimeline },
);
cartSchema.index({ status: 1, expiresAt: 1, _id: 1 }, { name: CART_INDEX_NAMES.expirySweep });
cartSchema.index(
  { purgeAt: 1 },
  {
    name: CART_INDEX_NAMES.terminalPurge,
    expireAfterSeconds: 0,
    partialFilterExpression: { status: { $in: CART_TERMINAL_STATUSES } },
  },
);

const baseJsonOptions = cartSchema.get("toJSON") as {
  transform?: (document: unknown, value: Record<string, unknown>) => Record<string, unknown>;
};
cartSchema.set("toJSON", {
  ...baseJsonOptions,
  transform(document: unknown, value: Record<string, unknown>) {
    const serialized = baseJsonOptions.transform?.(document, value) ?? value;
    delete serialized.guestTokenHash;
    return serialized;
  },
});

export function getCartModel(connection: Connection): Model<CartRecord> {
  return (
    (connection.models.Cart as Model<CartRecord> | undefined) ??
    connection.model<CartRecord>("Cart", cartSchema)
  );
}
