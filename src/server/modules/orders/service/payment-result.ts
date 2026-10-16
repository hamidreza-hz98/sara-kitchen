import "server-only";

import { Types } from "mongoose";
import type { Connection } from "mongoose";

import { getOrderPaymentView, type TransactionStatus } from "@/server/modules/transactions";

import { getOrderModel, type OrderStatus } from "../model/order";

export type CustomerPaymentResultState =
  "pending" | "success" | "failed" | "expired" | "cancelled" | "refunded";

export type CustomerPaymentResult = Readonly<{
  orderCode: string;
  orderStatus: OrderStatus;
  paymentStatus: TransactionStatus | "unknown";
  state: CustomerPaymentResultState;
  amountCents: number;
  currency: "EUR";
  updatedAt: Date;
  pollAfterMs: number | null;
  canStartNewOrder: boolean;
}>;

export class PaymentResultError extends Error {
  constructor(readonly code: "not_found") {
    super("Payment result not found.");
    this.name = "PaymentResultError";
  }
}

const successfulOrders = new Set<OrderStatus>([
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
  "completed",
]);

function resultState(
  orderStatus: OrderStatus,
  paymentStatus: TransactionStatus | "unknown",
): CustomerPaymentResultState {
  if (orderStatus === "refunded" || paymentStatus === "refunded") return "refunded";
  if (orderStatus === "cancelled" || paymentStatus === "cancelled") return "cancelled";
  if (orderStatus === "expired" || paymentStatus === "expired") return "expired";
  if (orderStatus === "payment_failed" || paymentStatus === "failed") return "failed";
  if (
    successfulOrders.has(orderStatus) &&
    (paymentStatus === "paid" || paymentStatus === "partially-refunded")
  )
    return "success";
  return "pending";
}

/** Customer-safe projection: the order code is never treated as authentication. */
export async function getCustomerPaymentResult(
  connection: Connection,
  customerId: string,
  orderCode: string,
): Promise<CustomerPaymentResult> {
  if (!Types.ObjectId.isValid(customerId)) throw new PaymentResultError("not_found");
  const order = await getOrderModel(connection)
    .findOne({ code: orderCode, customerId: new Types.ObjectId(customerId) })
    .select("code status customerId transactionIds pricing.totalCents currency updatedAt")
    .lean();
  if (!order) throw new PaymentResultError("not_found");

  const transactionId = order.transactionIds.at(-1)?.toString();
  const payment = transactionId ? await getOrderPaymentView(connection, transactionId) : null;
  const paymentMatches =
    payment?.orderId === order._id.toString() &&
    payment.customerId === customerId &&
    payment.currency === order.currency &&
    payment.requestedCents === order.pricing.totalCents;
  const paymentStatus = paymentMatches ? payment.status : "unknown";
  const state = resultState(order.status, paymentStatus);
  return Object.freeze({
    orderCode: order.code,
    orderStatus: order.status,
    paymentStatus,
    state,
    amountCents: order.pricing.totalCents,
    currency: order.currency,
    updatedAt: order.updatedAt,
    pollAfterMs: state === "pending" ? 2_500 : null,
    canStartNewOrder: ["failed", "expired", "cancelled"].includes(state),
  });
}
