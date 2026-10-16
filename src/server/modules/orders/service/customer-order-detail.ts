import "server-only";

import { Types } from "mongoose";
import type { Connection } from "mongoose";

import { getOrderPaymentView } from "@/server/modules/transactions";
import type { CustomerOrderDetail } from "@/types/customer-order-detail";

import { getOrderModel } from "../model/order";
import { ORDER_CODE_PATTERN } from "../policy/order-code";

/** Only immutable purchase facts and customer-visible lifecycle fields leave the Orders module. */
export async function getCustomerOrderDetail(
  connection: Connection,
  customerId: string,
  code: string,
): Promise<CustomerOrderDetail | null> {
  if (!/^[a-f\d]{24}$/iu.test(customerId) || !ORDER_CODE_PATTERN.test(code)) return null;
  const order = await getOrderModel(connection)
    .findOne({ customerId: new Types.ObjectId(customerId), code })
    .select(
      "code status revision createdAt currency customerSnapshot.firstName customerSnapshot.lastName addressSnapshot items.slug items.name items.quantity items.portionAmount items.portionUnit items.baseUnitPriceCents items.effectiveUnitPriceCents items.lineDiscountCents items.lineSubtotalCents pricing fulfillment notes statusHistory.status statusHistory.paymentStatus statusHistory.occurredAt transactionIds",
    )
    .lean();
  if (!order) return null;
  const latestTransactionId = order.transactionIds.at(-1)?.toString();
  const payment = latestTransactionId
    ? await getOrderPaymentView(connection, latestTransactionId)
    : null;
  const paymentStatus =
    payment?.orderId === order._id.toString() &&
    payment.customerId === customerId &&
    payment.currency === order.currency &&
    payment.requestedCents === order.pricing.totalCents
      ? payment.status
      : "unknown";
  return {
    code: order.code,
    status: order.status,
    revision: order.revision,
    createdAt: order.createdAt.toISOString(),
    currency: order.currency,
    customerName: `${order.customerSnapshot.firstName} ${order.customerSnapshot.lastName}`.trim(),
    notes: order.notes,
    address: order.addressSnapshot
      ? {
          name: order.addressSnapshot.name,
          recipientName: order.addressSnapshot.recipientName,
          recipientMobile: order.addressSnapshot.recipientMobile,
          formattedAddress: order.addressSnapshot.formattedAddress,
          postalCode: order.addressSnapshot.postalCode,
          deliveryNotes: order.addressSnapshot.deliveryNotes,
        }
      : null,
    items: order.items.map((item) => ({
      slug: item.slug,
      name: item.name,
      quantity: item.quantity,
      portionAmount: item.portionAmount,
      portionUnit: item.portionUnit,
      baseUnitPriceCents: item.baseUnitPriceCents,
      effectiveUnitPriceCents: item.effectiveUnitPriceCents,
      lineDiscountCents: item.lineDiscountCents,
      lineSubtotalCents: item.lineSubtotalCents,
    })),
    pricing: {
      subtotalCents: order.pricing.subtotalCents,
      discountCents: order.pricing.discountCents,
      deliveryFeeCents: order.pricing.deliveryFeeCents,
      taxCents: order.pricing.taxCents,
      adjustmentsCents: order.pricing.adjustmentsCents,
      totalCents: order.pricing.totalCents,
      freeDeliveryApplied: order.pricing.delivery.freeDeliveryApplied,
    },
    fulfillment: {
      method: order.fulfillment.method,
      leadTimeMinutes: order.fulfillment.leadTimeMinutes,
      earliestReadyAt: order.fulfillment.earliestReadyAt.toISOString(),
      completedAt: order.fulfillment.completedAt?.toISOString() ?? null,
    },
    paymentStatus,
    canCancel: order.status === "pending_payment" && paymentStatus === "cancelled",
    canStartNewOrder: ["payment_failed", "expired", "cancelled"].includes(order.status),
    history: order.statusHistory.map((event) => ({
      status: event.status,
      paymentStatus: event.paymentStatus,
      occurredAt: event.occurredAt.toISOString(),
    })),
  };
}
