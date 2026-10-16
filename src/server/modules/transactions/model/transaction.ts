import "server-only";

import { isValidObjectId, Schema } from "mongoose";
import type { Connection, Model, Types } from "mongoose";

import { createBaseSchema, type BaseDocumentFields } from "@/server/database/schema";

import { replayTransactionHistory } from "../policy/transaction-state-machine";

export const TRANSACTION_METHODS = ["mbway", "paypal", "card", "cash"] as const;
export const TRANSACTION_PROVIDERS = [
  "mbway-sandbox",
  "mbway-live",
  "paypal",
  "card-gateway",
  "manual",
] as const;
export const TRANSACTION_STATUSES = [
  "created",
  "pending",
  "authorized",
  "paid",
  "failed",
  "cancelled",
  "expired",
  "partially-refunded",
  "refunded",
] as const;
export const TRANSACTION_EVENT_SOURCES = ["system", "customer", "admin", "provider"] as const;
export const TRANSACTION_CURRENCY = "EUR" as const;
export const TRANSACTION_MAX_AMOUNT_CENTS = 100_000_000;
export const TRANSACTION_MAX_EVENTS = 500;
export const TRANSACTION_APPEND_ONLY_ERROR =
  "Transaction events are append-only; use document save to append.";
export const TRANSACTION_REQUESTED_AMOUNT_IMMUTABLE_ERROR =
  "The original requested amount is immutable.";
export const TRANSACTION_INDEX_NAMES = Object.freeze({
  timeline: "transaction_timeline",
  order: "transaction_order_timeline",
  customer: "transaction_customer_timeline",
  status: "transaction_status_timeline",
  idempotency: "transaction_idempotency_digest_unique",
  providerPayment: "transaction_provider_payment_unique",
} as const);

export type TransactionMethod = (typeof TRANSACTION_METHODS)[number];
export type TransactionProvider = (typeof TRANSACTION_PROVIDERS)[number];
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];
export type TransactionEventSource = (typeof TRANSACTION_EVENT_SOURCES)[number];

export type TransactionAmounts = {
  requestedCents: number;
  authorizedCents: number;
  capturedCents: number;
  refundedCents: number;
};

export type TransactionProviderReferences = {
  paymentId: string | null;
  requestId: string | null;
};

export type TransactionEvent = {
  eventKey: string;
  source: TransactionEventSource;
  status: TransactionStatus;
  amountCents: number | null;
  responseCode: string | null;
  providerEventId: string | null;
  occurredAt: Date;
  recordedAt: Date;
};

export type TransactionRecord = BaseDocumentFields & {
  orderId: Types.ObjectId;
  customerId: Types.ObjectId;
  method: TransactionMethod;
  provider: TransactionProvider;
  currency: typeof TRANSACTION_CURRENCY;
  amounts: TransactionAmounts;
  status: TransactionStatus;
  providerReferences: TransactionProviderReferences;
  idempotencyKeyHash: string;
  responseCode: string | null;
  internalNote: string | null;
  managementRevision: number;
  events: TransactionEvent[];
};

const safeInteger = (value: number) =>
  Number.isSafeInteger(value) && value >= 0 && value <= TRANSACTION_MAX_AMOUNT_CENTS;
const safeReference = (value: string | null) =>
  value === null ||
  (value.length >= 1 &&
    value.length <= 128 &&
    /^[A-Za-z0-9._:-]+$/u.test(value) &&
    !/\d{12,}/u.test(value));
const safeCode = (value: string | null) =>
  value === null ||
  (value.length >= 1 &&
    value.length <= 64 &&
    /^[A-Z0-9_:-]+$/u.test(value) &&
    !/\d{12,}/u.test(value));

const amountField = (defaultValue?: number) => ({
  type: Number,
  required: true,
  ...(defaultValue === undefined ? {} : { default: defaultValue }),
  validate: { validator: safeInteger, message: "Amount must be non-negative integer cents." },
});

const amountsSchema = new Schema<TransactionAmounts>(
  {
    requestedCents: amountField(),
    authorizedCents: amountField(0),
    capturedCents: amountField(0),
    refundedCents: amountField(0),
  },
  { _id: false, id: false, strict: "throw" },
);

const providerReferencesSchema = new Schema<TransactionProviderReferences>(
  {
    paymentId: { type: String, default: null, validate: { validator: safeReference } },
    requestId: { type: String, default: null, validate: { validator: safeReference } },
  },
  { _id: false, id: false, strict: "throw" },
);

const eventSchema = new Schema<TransactionEvent>(
  {
    eventKey: { type: String, required: true, validate: { validator: safeReference } },
    source: { type: String, required: true, enum: TRANSACTION_EVENT_SOURCES },
    status: { type: String, required: true, enum: TRANSACTION_STATUSES },
    amountCents: {
      type: Number,
      default: null,
      validate: { validator: (value: number | null) => value === null || safeInteger(value) },
    },
    responseCode: { type: String, default: null, validate: { validator: safeCode } },
    providerEventId: { type: String, default: null, validate: { validator: safeReference } },
    occurredAt: { type: Date, required: true },
    recordedAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false, id: false, strict: "throw" },
);

export const transactionSchema = createBaseSchema<TransactionRecord>(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      immutable: true,
      validate: { validator: isValidObjectId },
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      immutable: true,
      validate: { validator: isValidObjectId },
    },
    method: { type: String, enum: TRANSACTION_METHODS, required: true, immutable: true },
    provider: { type: String, enum: TRANSACTION_PROVIDERS, required: true, immutable: true },
    currency: {
      type: String,
      enum: [TRANSACTION_CURRENCY],
      required: true,
      immutable: true,
    },
    amounts: { type: amountsSchema, required: true },
    status: { type: String, enum: TRANSACTION_STATUSES, required: true, default: "created" },
    providerReferences: {
      type: providerReferencesSchema,
      required: true,
      default: () => ({}),
      select: false,
    },
    idempotencyKeyHash: {
      type: String,
      required: true,
      immutable: true,
      select: false,
      validate: { validator: (value: string) => /^[a-f0-9]{64}$/u.test(value) },
    },
    responseCode: { type: String, default: null, validate: { validator: safeCode } },
    internalNote: { type: String, trim: true, maxlength: 1_000, default: null },
    managementRevision: { type: Number, required: true, default: 0, min: 0, max: 10_000 },
    events: { type: [eventSchema], required: true, default: [] },
  },
  { collection: "transactions", schemaVersion: 1 },
);

transactionSchema.set("strict", "throw");

const matchingProviders: Record<TransactionMethod, readonly TransactionProvider[]> = {
  mbway: ["mbway-sandbox", "mbway-live"],
  paypal: ["paypal"],
  card: ["card-gateway"],
  cash: ["manual"],
};

function eventFingerprint(event: TransactionEvent): string {
  return JSON.stringify([
    event.eventKey,
    event.source,
    event.status,
    event.amountCents,
    event.responseCode,
    event.providerEventId,
    event.occurredAt instanceof Date ? event.occurredAt.getTime() : null,
    event.recordedAt instanceof Date ? event.recordedAt.getTime() : null,
  ]);
}

function rememberEvents(document: {
  events: TransactionEvent[];
  amounts: TransactionAmounts;
  $locals: Record<string, unknown>;
}) {
  document.$locals.savedEventFingerprints = document.events.map(eventFingerprint);
  document.$locals.savedRequestedCents = document.amounts.requestedCents;
}

function hasEditedRequestedCents(document: {
  isNew: boolean;
  amounts: TransactionAmounts;
  $locals: Record<string, unknown>;
}) {
  return (
    !document.isNew && document.$locals.savedRequestedCents !== document.amounts.requestedCents
  );
}

function hasEditedSavedEvents(document: {
  isNew: boolean;
  events: TransactionEvent[];
  $locals: Record<string, unknown>;
}) {
  if (document.isNew) return false;
  const saved = document.$locals.savedEventFingerprints as string[] | undefined;
  return (
    !saved ||
    document.events.length < saved.length ||
    saved.some((fingerprint, i) => {
      const event = document.events[i];
      return !event || eventFingerprint(event) !== fingerprint;
    })
  );
}

function historyError(document: TransactionRecord): string | null {
  try {
    const replayed = replayTransactionHistory(document.amounts.requestedCents, document.events);
    if (replayed.status !== document.status) return "Transaction status must match its history.";
    for (const key of [
      "requestedCents",
      "authorizedCents",
      "capturedCents",
      "refundedCents",
    ] as const) {
      if (replayed.amounts[key] !== document.amounts[key]) {
        return "Transaction amounts must match its history.";
      }
    }
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid transaction history.";
  }
}

transactionSchema.post("init", rememberEvents);
transactionSchema.post("save", rememberEvents);

transactionSchema.pre("validate", function validateTransaction() {
  if (!matchingProviders[this.method]?.includes(this.provider)) {
    this.invalidate("provider", "Provider does not support the selected payment method.");
  }

  const amounts = this.amounts;
  if (amounts) {
    if (amounts.authorizedCents > amounts.requestedCents) {
      this.invalidate("amounts.authorizedCents", "Authorization cannot exceed requested amount.");
    }
    if (amounts.capturedCents > amounts.requestedCents) {
      this.invalidate("amounts.capturedCents", "Capture cannot exceed requested amount.");
    }
    if (amounts.refundedCents > amounts.capturedCents) {
      this.invalidate("amounts.refundedCents", "Refund cannot exceed captured amount.");
    }
  }

  if (this.events.length < 1 || this.events.length > TRANSACTION_MAX_EVENTS) {
    this.invalidate("events", "Transaction needs 1 to 500 bounded events.");
  }
  if (this.amounts) {
    const error = historyError(this);
    if (error) this.invalidate("events", error);
  }
  const keys = this.events.map((event) => event.eventKey);
  if (new Set(keys).size !== keys.length) {
    this.invalidate("events", "Transaction event keys must be unique.");
  }
  const providerEventIds = this.events
    .map((event) => event.providerEventId)
    .filter((value): value is string => value !== null);
  if (new Set(providerEventIds).size !== providerEventIds.length) {
    this.invalidate("events", "Provider event IDs must be unique within a transaction.");
  }

  if (hasEditedSavedEvents(this)) {
    this.invalidate("events", TRANSACTION_APPEND_ONLY_ERROR);
  }
  if (hasEditedRequestedCents(this)) {
    this.invalidate("amounts.requestedCents", TRANSACTION_REQUESTED_AMOUNT_IMMUTABLE_ERROR);
  }
});

transactionSchema.pre("save", function rejectEventRewrite() {
  if (hasEditedSavedEvents(this)) throw new Error(TRANSACTION_APPEND_ONLY_ERROR);
  if (hasEditedRequestedCents(this)) throw new Error(TRANSACTION_REQUESTED_AMOUNT_IMMUTABLE_ERROR);
  const error = historyError(this);
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
  transactionSchema.pre(operation, function rejectQueryMutation() {
    throw new Error(TRANSACTION_APPEND_ONLY_ERROR);
  });
}
transactionSchema.pre("deleteOne", { document: true, query: false }, function rejectDelete() {
  throw new Error(TRANSACTION_APPEND_ONLY_ERROR);
});
transactionSchema.pre("bulkWrite", function rejectBulkMutation() {
  throw new Error(TRANSACTION_APPEND_ONLY_ERROR);
});

transactionSchema.index(
  { idempotencyKeyHash: 1 },
  { name: TRANSACTION_INDEX_NAMES.idempotency, unique: true },
);
transactionSchema.index(
  { provider: 1, "providerReferences.paymentId": 1 },
  {
    name: TRANSACTION_INDEX_NAMES.providerPayment,
    unique: true,
    partialFilterExpression: { "providerReferences.paymentId": { $type: "string" } },
  },
);
transactionSchema.index(
  { orderId: 1, createdAt: -1, _id: -1 },
  { name: TRANSACTION_INDEX_NAMES.order },
);
transactionSchema.index({ createdAt: -1, _id: -1 }, { name: TRANSACTION_INDEX_NAMES.timeline });
transactionSchema.index(
  { customerId: 1, createdAt: -1, _id: -1 },
  { name: TRANSACTION_INDEX_NAMES.customer },
);
transactionSchema.index(
  { status: 1, createdAt: -1, _id: -1 },
  { name: TRANSACTION_INDEX_NAMES.status },
);
transactionSchema.index(
  { "events.occurredAt": 1, "events.status": 1 },
  { name: "transaction_financial_event_period" },
);

const baseJsonOptions = transactionSchema.get("toJSON") as {
  transform?: (document: unknown, value: Record<string, unknown>) => Record<string, unknown>;
};
transactionSchema.set("toJSON", {
  ...baseJsonOptions,
  transform(document: unknown, value: Record<string, unknown>) {
    const serialized = baseJsonOptions.transform?.(document, value) ?? value;
    delete serialized.idempotencyKeyHash;
    delete serialized.providerReferences;
    const events = serialized.events as Record<string, unknown>[] | undefined;
    for (const event of events ?? []) delete event.providerEventId;
    return serialized;
  },
});

export function getTransactionModel(connection: Connection): Model<TransactionRecord> {
  return (
    (connection.models.Transaction as Model<TransactionRecord> | undefined) ??
    connection.model<TransactionRecord>("Transaction", transactionSchema)
  );
}
