import "server-only";

import { randomUUID } from "node:crypto";

import type { ClientSession, Connection } from "mongoose";

import { createDishSoldCountProjector } from "@/server/modules/dishes";
import { recordAuditEvent } from "@/server/modules/logs";
import type { VerifiedPaymentState } from "@/server/modules/transactions";

import { getOrderModel, type OrderStatus } from "../model/order";
import { planOrderTransition, soldCountLifecycle } from "../policy/order-state-machine";
import { queueOrderNotifications } from "./notification-outbox";

export class OrderPaymentSyncError extends Error {
  constructor() {
    super("Verified payment does not match the current order lifecycle.");
    this.name = "OrderPaymentSyncError";
  }
}

/** Called inside the payment workflow transaction; never performs a provider network call. */
export async function applyVerifiedPaymentStateToOrder(
  connection: Connection,
  state: VerifiedPaymentState,
  session: ClientSession,
  requestId: string,
): Promise<boolean> {
  const order = await getOrderModel(connection).findById(state.orderId).session(session);
  if (
    !order ||
    order.customerId.toString() !== state.customerId ||
    order.transactionIds.at(-1)?.toString() !== state.transactionId
  )
    throw new OrderPaymentSyncError();

  const from = order.status;
  const previousPayment = order.statusHistory.at(-1)!.paymentStatus;
  let to: OrderStatus | null = null;
  let reasonCode: string | null = null;
  if (from === "pending_payment") {
    if (state.status === "paid" || state.status === "partially-refunded") to = "confirmed";
    else if (state.status === "failed") to = "payment_failed";
    else if (state.status === "expired") to = "expired";
    else if (state.status === "cancelled") {
      to = "cancelled";
      reasonCode = "payment_cancelled";
    }
  } else if (["confirmed", "preparing", "ready", "out_for_delivery", "completed"].includes(from)) {
    if (state.status === "refunded") to = "refunded";
    else if (state.status === "partially-refunded" && previousPayment !== "partially-refunded") {
      to = from;
      reasonCode = "payment_partial_refund";
    }
  } else if (from === "cancelled" && state.status === "refunded") to = "refunded";

  if (!to) {
    if (
      state.status === previousPayment ||
      (from === "pending_payment" && ["created", "pending", "authorized"].includes(state.status)) ||
      (state.status === "paid" &&
        ["confirmed", "preparing", "ready", "out_for_delivery", "completed", "cancelled"].includes(
          from,
        ))
    )
      return false;
    throw new OrderPaymentSyncError();
  }
  const effects = planOrderTransition({
    from,
    to,
    method: order.fulfillment.method,
    paymentStatus: state.status,
    priorPaymentStatus: previousPayment,
    actor: { kind: "system" },
    orderCustomerId: order.customerId.toString(),
    reasonCode,
  });
  const at = new Date();
  order.status = to;
  order.statusHistory.push({
    eventKey: `payment:${randomUUID()}`,
    status: to,
    actorKind: "system",
    actorId: null,
    reasonCode,
    paymentStatus: state.status,
    occurredAt: state.occurredAt,
    recordedAt: at,
  });
  order.revision = order.statusHistory.length;
  if (to === "refunded") order.refundFollowUpRequired = false;
  await order.save({ session });
  await queueOrderNotifications(
    connection,
    order,
    order.statusHistory.at(-1)!.eventKey,
    effects.notificationIntents,
    session,
  );
  if (effects.recomputeSoldCount) {
    const lifecycle = soldCountLifecycle({ status: order.status, paymentStatus: state.status });
    await createDishSoldCountProjector(connection).project(
      {
        orderId: order._id.toString(),
        revision: order.revision,
        ...lifecycle,
        items: order.items.map((item) => ({
          dishId: item.dishId.toString(),
          quantity: item.quantity,
        })),
      },
      session,
    );
  }
  await recordAuditEvent(
    connection,
    {
      action: "order.order.status-change",
      actor: { kind: "system", ref: null, snapshot: { displayName: null, role: null } },
      resource: {
        kind: "order",
        ref: order._id.toString(),
        snapshot: { code: order.code, label: null, status: order.status },
      },
      outcome: "success",
      requestId,
      context: { from, to, paymentStatus: state.status },
      network: { policy: "omitted", ipHash: null, ipAddress: null },
      userAgent: null,
    },
    { session },
  );
  return true;
}
