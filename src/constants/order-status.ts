/** Shared display-safe order status vocabulary. Server state transitions remain authoritative. */
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

export type OrderStatus = (typeof ORDER_STATUSES)[number];
