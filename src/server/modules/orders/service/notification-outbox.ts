import "server-only";

import type { ClientSession, Connection } from "mongoose";

import { getOrderNotificationModel } from "../model/order-notification";
import type { OrderRecord } from "../model/order";
import type { OrderNotificationIntent } from "../policy/order-state-machine";
import { renderOrderNotification } from "./notification-templates";

/** Persist intents in the caller's order/payment transaction; never send from here. */
export async function queueOrderNotifications(
  connection: Connection,
  order: OrderRecord,
  eventKey: string,
  intents: readonly OrderNotificationIntent[],
  session: ClientSession,
): Promise<void> {
  if (intents.length === 0) return;
  const Model = getOrderNotificationModel(connection);
  for (const intent of intents) {
    const rendered = renderOrderNotification(intent, order.locale, order.code);
    await Model.updateOne(
      { eventKey, intent },
      {
        $setOnInsert: {
          orderId: order._id,
          customerId: order.customerId,
          orderCode: order.code,
          eventKey,
          intent,
          channel: intent.startsWith("employer.") ? "whatsapp" : "in_app",
          ...rendered,
          state: intent.startsWith("employer.") ? "pending" : "delivered",
          attempts: 0,
          nextAttemptAt: new Date(),
          deliveredAt: intent.startsWith("employer.") ? null : new Date(),
        },
      },
      { upsert: true, session },
    );
  }
}
