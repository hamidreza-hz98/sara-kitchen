import { createHash } from "node:crypto";

export const SOLD_COUNT_FULFILLMENT_STATES = ["open", "completed", "cancelled"] as const;
export const SOLD_COUNT_PAYMENT_STATES = [
  "unpaid",
  "paid",
  "partially_refunded",
  "refunded",
] as const;

export type SoldCountFulfillmentState = (typeof SOLD_COUNT_FULFILLMENT_STATES)[number];
export type SoldCountPaymentState = (typeof SOLD_COUNT_PAYMENT_STATES)[number];

export type SoldCountOrderItem = Readonly<{
  dishId: string;
  quantity: number;
  refundedQuantity?: number;
}>;

export type SoldCountOrderSnapshot = Readonly<{
  orderId: string;
  revision: number;
  fulfillmentState: SoldCountFulfillmentState;
  paymentState: SoldCountPaymentState;
  items: readonly SoldCountOrderItem[];
}>;

export type SoldCountContribution = Readonly<{
  dishId: string;
  quantity: number;
}>;

export type NormalizedSoldCountProjection = Readonly<{
  orderId: string;
  revision: number;
  fulfillmentState: SoldCountFulfillmentState;
  paymentState: SoldCountPaymentState;
  contributions: readonly SoldCountContribution[];
  fingerprint: string;
}>;

export class SoldCountPolicyError extends Error {
  constructor(
    readonly code:
      | "invalid_order_id"
      | "invalid_dish_id"
      | "invalid_revision"
      | "duplicate_dish"
      | "invalid_quantity"
      | "invalid_refunded_quantity",
    message: string,
  ) {
    super(message);
    this.name = "SoldCountPolicyError";
  }
}

/**
 * Converts an order snapshot into the exact quantity each dish should currently contribute.
 * Only fulfilled and settled units count. Monetary goodwill refunds keep units sold unless the
 * order records an item-level refunded quantity.
 */
export function deriveSoldCountProjection(
  snapshot: SoldCountOrderSnapshot,
): NormalizedSoldCountProjection {
  if (!/^[a-f\d]{24}$/iu.test(snapshot.orderId)) {
    throw new SoldCountPolicyError(
      "invalid_order_id",
      "Order ID must be a valid MongoDB ObjectId.",
    );
  }
  if (!Number.isSafeInteger(snapshot.revision) || snapshot.revision < 1) {
    throw new SoldCountPolicyError(
      "invalid_revision",
      "Order revision must be a positive integer.",
    );
  }

  const seen = new Set<string>();
  const normalizedItems = snapshot.items
    .map((item) => {
      if (!/^[a-f\d]{24}$/iu.test(item.dishId)) {
        throw new SoldCountPolicyError(
          "invalid_dish_id",
          "Dish ID must be a valid MongoDB ObjectId.",
        );
      }
      const dishId = item.dishId.toLowerCase();
      if (seen.has(dishId)) {
        throw new SoldCountPolicyError(
          "duplicate_dish",
          "An order snapshot must contain one aggregated line per dish.",
        );
      }
      seen.add(dishId);
      if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) {
        throw new SoldCountPolicyError(
          "invalid_quantity",
          "Dish quantity must be a positive integer.",
        );
      }
      const refundedQuantity = item.refundedQuantity ?? 0;
      if (
        !Number.isSafeInteger(refundedQuantity) ||
        refundedQuantity < 0 ||
        refundedQuantity > item.quantity
      ) {
        throw new SoldCountPolicyError(
          "invalid_refunded_quantity",
          "Refunded quantity must be an integer between zero and the ordered quantity.",
        );
      }
      return { dishId, quantity: item.quantity, refundedQuantity };
    })
    .sort((left, right) => left.dishId.localeCompare(right.dishId));

  const qualifies =
    snapshot.fulfillmentState === "completed" &&
    (snapshot.paymentState === "paid" || snapshot.paymentState === "partially_refunded");
  const contributions = qualifies
    ? normalizedItems
        .map(({ dishId, quantity, refundedQuantity }) => ({
          dishId,
          quantity: quantity - refundedQuantity,
        }))
        .filter(({ quantity }) => quantity > 0)
    : [];

  const canonical = JSON.stringify({
    fulfillmentState: snapshot.fulfillmentState,
    items: normalizedItems,
    orderId: snapshot.orderId.toLowerCase(),
    paymentState: snapshot.paymentState,
    revision: snapshot.revision,
  });

  return Object.freeze({
    orderId: snapshot.orderId.toLowerCase(),
    revision: snapshot.revision,
    fulfillmentState: snapshot.fulfillmentState,
    paymentState: snapshot.paymentState,
    contributions: Object.freeze(contributions),
    fingerprint: createHash("sha256").update(canonical).digest("hex"),
  });
}
