import { hasAdminPermission, type AdminRole } from "@/constants/admin-access";
import type { SoldCountFulfillmentState, SoldCountPaymentState } from "@/server/modules/dishes";
import type { TransactionStatus } from "@/server/modules/transactions";

import type { OrderFulfillmentMethod, OrderStatus } from "../model/order";

export const ORDER_TRANSITIONS = Object.freeze({
  pending_payment: ["confirmed", "payment_failed", "cancelled", "expired"],
  confirmed: ["preparing", "cancelled", "refunded"],
  preparing: ["ready", "cancelled", "refunded"],
  ready: ["out_for_delivery", "completed", "cancelled", "refunded"],
  out_for_delivery: ["completed", "cancelled", "refunded"],
  completed: ["refunded"],
  cancelled: ["refunded"],
  payment_failed: [],
  expired: [],
  refunded: [],
} as const satisfies Record<OrderStatus, readonly OrderStatus[]>);

export type OrderTransitionActor =
  | Readonly<{ kind: "system" }>
  | Readonly<{ kind: "customer"; customerId: string }>
  | Readonly<{ kind: "admin"; adminId: string; role: AdminRole; active: boolean }>;

export type OrderTransitionInput = Readonly<{
  from: OrderStatus;
  to: OrderStatus;
  method: OrderFulfillmentMethod;
  paymentStatus: TransactionStatus;
  priorPaymentStatus: TransactionStatus;
  actor: OrderTransitionActor;
  orderCustomerId: string;
  reasonCode: string | null;
}>;

export type OrderNotificationIntent =
  | "customer.order_received"
  | "customer.order_confirmed"
  | "customer.order_ready"
  | "customer.out_for_delivery"
  | "customer.order_completed"
  | "customer.order_cancelled"
  | "customer.payment_failed"
  | "customer.payment_expired"
  | "customer.order_refunded"
  | "employer.order_submitted"
  | "employer.order_paid"
  | "employer.order_cancelled"
  | "employer.order_refunded";

export type OrderTransitionEffects = Readonly<{
  customerVisibleStatus: OrderStatus;
  notificationIntents: readonly OrderNotificationIntent[];
  recomputeSoldCount: boolean;
  refundFollowUpRequired: boolean;
}>;

export class OrderTransitionError extends Error {
  constructor(
    readonly code:
      | "invalid_transition"
      | "payment_mismatch"
      | "wrong_actor"
      | "permission_denied"
      | "ownership_mismatch"
      | "fulfillment_mismatch"
      | "reason_required"
      | "invalid_initial_state",
    message: string,
  ) {
    super(message);
    this.name = "OrderTransitionError";
  }
}

const reject = (code: OrderTransitionError["code"], message: string): never => {
  throw new OrderTransitionError(code, message);
};

const activeFulfillmentStatuses = new Set<OrderStatus>([
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
  "completed",
]);
const settledPayment = new Set<TransactionStatus>(["paid", "partially-refunded"]);

export function validateInitialOrderState(input: {
  status: OrderStatus;
  actorKind: "system" | "admin" | "customer";
  paymentStatus: TransactionStatus;
}): void {
  if (
    input.status !== "pending_payment" ||
    input.actorKind !== "system" ||
    (input.paymentStatus !== "created" && input.paymentStatus !== "pending")
  ) {
    reject("invalid_initial_state", "An order starts awaiting an uncollected payment.");
  }
}

/** Graph, provider-state and actor-kind checks are replayable from immutable history alone. */
export function validateOrderTransitionEvidence(
  input: Omit<OrderTransitionInput, "actor" | "orderCustomerId"> & {
    actorKind: OrderTransitionActor["kind"];
  },
): void {
  const { from, to, method, paymentStatus, priorPaymentStatus, actorKind, reasonCode } = input;
  if (from === to) {
    if (
      actorKind !== "system" ||
      reasonCode !== "payment_partial_refund" ||
      !activeFulfillmentStatuses.has(from) ||
      paymentStatus !== "partially-refunded" ||
      !settledPayment.has(priorPaymentStatus)
    ) {
      reject(
        "invalid_transition",
        "Only a verified partial refund can append a same-status event.",
      );
    }
    return;
  }
  if (!(ORDER_TRANSITIONS[from] as readonly OrderStatus[]).includes(to)) {
    reject("invalid_transition", `Order cannot move from ${from} to ${to}.`);
  }
  if (
    (to === "out_for_delivery" && method !== "delivery") ||
    (from === "ready" && to === "completed" && method !== "pickup") ||
    (from === "out_for_delivery" && to === "completed" && method !== "delivery")
  ) {
    reject("fulfillment_mismatch", "Fulfillment transition does not match pickup/delivery mode.");
  }
  if (to === "confirmed" && (actorKind !== "system" || !settledPayment.has(paymentStatus))) {
    reject("payment_mismatch", "Only settled payment may confirm an order.");
  }
  if (
    (to === "payment_failed" && (actorKind !== "system" || paymentStatus !== "failed")) ||
    (to === "expired" && (actorKind !== "system" || paymentStatus !== "expired"))
  ) {
    reject("payment_mismatch", "Payment failure/expiry must follow the matching provider state.");
  }
  if (to === "refunded" && (actorKind !== "system" || paymentStatus !== "refunded")) {
    reject("payment_mismatch", "Only a fully refunded transaction may refund the order.");
  }
  if (to === "cancelled") {
    if (!reasonCode) reject("reason_required", "Cancellation needs a reason code.");
    if (from === "pending_payment") {
      if (
        paymentStatus !== "cancelled" ||
        (actorKind === "system" && reasonCode !== "payment_cancelled")
      ) {
        reject(
          "payment_mismatch",
          "Pending-payment cancellation requires confirmed provider cancellation.",
        );
      }
    } else if (actorKind !== "admin" || !settledPayment.has(paymentStatus)) {
      reject("wrong_actor", "Paid-order cancellation requires an authorized administrator.");
    }
  } else if (["preparing", "ready", "out_for_delivery", "completed"].includes(to)) {
    if (actorKind !== "admin") reject("wrong_actor", "Fulfillment moves require an administrator.");
    if (!settledPayment.has(paymentStatus))
      reject("payment_mismatch", "Fulfillment requires settled payment.");
  }
}

const notificationByStatus: Partial<Record<OrderStatus, readonly OrderNotificationIntent[]>> = {
  confirmed: ["customer.order_confirmed", "employer.order_paid"],
  ready: ["customer.order_ready"],
  out_for_delivery: ["customer.out_for_delivery"],
  completed: ["customer.order_completed"],
  cancelled: ["customer.order_cancelled", "employer.order_cancelled"],
  payment_failed: ["customer.payment_failed"],
  expired: ["customer.payment_expired"],
  refunded: ["customer.order_refunded", "employer.order_refunded"],
};

export function initialOrderEffects(): OrderTransitionEffects {
  return Object.freeze({
    customerVisibleStatus: "pending_payment",
    notificationIntents: Object.freeze([
      "customer.order_received",
      "employer.order_submitted",
    ] as const),
    recomputeSoldCount: false,
    refundFollowUpRequired: false,
  });
}

/** Pure decision: callers persist history/payment/outbox atomically and send only after commit. */
export function planOrderTransition(input: OrderTransitionInput): OrderTransitionEffects {
  validateOrderTransitionEvidence({ ...input, actorKind: input.actor.kind });
  if (
    input.actor.kind === "customer" &&
    (input.from !== "pending_payment" ||
      input.to !== "cancelled" ||
      input.actor.customerId !== input.orderCustomerId)
  ) {
    reject("ownership_mismatch", "Only the order owner may cancel their unpaid order.");
  }
  if (input.actor.kind === "admin") {
    const permission = input.to === "cancelled" ? "orders:cancel" : "orders:update";
    if (!hasAdminPermission(input.actor, permission)) {
      reject("permission_denied", "Administrator lacks this order permission.");
    }
  }
  const sameStatus = input.from === input.to;
  return Object.freeze({
    customerVisibleStatus: input.to,
    notificationIntents: Object.freeze(
      sameStatus ? [] : [...(notificationByStatus[input.to] ?? [])],
    ),
    recomputeSoldCount:
      input.to === "completed" ||
      input.to === "refunded" ||
      (sameStatus && input.from === "completed"),
    refundFollowUpRequired: input.to === "cancelled" && settledPayment.has(input.paymentStatus),
  });
}

export function soldCountLifecycle(input: {
  status: OrderStatus;
  paymentStatus: TransactionStatus;
}): {
  fulfillmentState: SoldCountFulfillmentState;
  paymentState: SoldCountPaymentState;
} {
  const fulfillmentState =
    input.status === "completed"
      ? "completed"
      : input.status === "cancelled" || input.status === "refunded"
        ? "cancelled"
        : "open";
  const paymentState =
    input.paymentStatus === "paid"
      ? "paid"
      : input.paymentStatus === "partially-refunded"
        ? "partially_refunded"
        : input.paymentStatus === "refunded"
          ? "refunded"
          : "unpaid";
  return { fulfillmentState, paymentState };
}
