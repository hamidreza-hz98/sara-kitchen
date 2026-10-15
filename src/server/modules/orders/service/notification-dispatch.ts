import "server-only";

import { randomUUID } from "node:crypto";

import type { Connection } from "mongoose";

import { getOrderNotificationModel } from "../model/order-notification";

export type EmployerMessageTransport = Readonly<{
  /** Must return the same provider message for retries using the same key. */
  send(
    input: Readonly<{ idempotencyKey: string; title: string; body: string }>,
  ): Promise<{ messageId: string }>;
}>;

const MAX_ATTEMPTS = 5;
const LEASE_MS = 60_000;
const BACKOFF_MS = 30_000;

/** One bounded dispatch pass. A scheduler must invoke this; no network I/O runs in order transactions. */
export async function dispatchOrderNotifications(
  connection: Connection,
  transport: EmployerMessageTransport,
  options: { now?: () => Date; limit?: number } = {},
) {
  const Model = getOrderNotificationModel(connection);
  const now = options.now ?? (() => new Date());
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);
  let delivered = 0;
  let failed = 0;
  for (let index = 0; index < limit; index++) {
    const at = now();
    const leaseToken = randomUUID();
    const item = await Model.findOneAndUpdate(
      {
        channel: "whatsapp",
        nextAttemptAt: { $lte: at },
        $or: [{ state: "pending" }, { state: "in_flight", lockedUntil: { $lte: at } }],
      },
      {
        $set: {
          state: "in_flight",
          leaseToken,
          lockedUntil: new Date(at.getTime() + LEASE_MS),
        },
        $inc: { attempts: 1 },
      },
      { sort: { nextAttemptAt: 1, _id: 1 }, returnDocument: "after" },
    );
    if (!item) break;
    try {
      const result = await transport.send({
        idempotencyKey: `${item.eventKey}:${item.intent}`,
        title: item.title,
        body: item.body,
      });
      await Model.updateOne(
        { _id: item._id, leaseToken, state: "in_flight" },
        {
          $set: {
            state: "delivered",
            deliveredAt: now(),
            providerMessageId: result.messageId,
            lockedUntil: null,
            leaseToken: null,
            lastErrorCode: null,
          },
        },
      );
      delivered++;
    } catch {
      const terminal = item.attempts >= MAX_ATTEMPTS;
      await Model.updateOne(
        { _id: item._id, leaseToken, state: "in_flight" },
        {
          $set: {
            state: terminal ? "dead" : "pending",
            nextAttemptAt: new Date(now().getTime() + BACKOFF_MS * 2 ** (item.attempts - 1)),
            lockedUntil: null,
            leaseToken: null,
            lastErrorCode: "delivery_failed",
          },
        },
      );
      failed++;
    }
  }
  return {
    delivered,
    failed,
    pending: await Model.countDocuments({ channel: "whatsapp", state: "pending" }),
    dead: await Model.countDocuments({ channel: "whatsapp", state: "dead" }),
  };
}

export async function listCustomerOrderNotifications(
  connection: Connection,
  customerId: string,
  limit = 20,
) {
  return getOrderNotificationModel(connection)
    .find({ customerId, channel: "in_app" })
    .sort({ createdAt: -1, _id: -1 })
    .limit(Math.min(Math.max(limit, 1), 50))
    .select("orderCode intent locale title body deliveredAt createdAt")
    .lean();
}

/** Aggregate only; never exposes recipient PII or message bodies to health monitoring. */
export async function getOrderNotificationDeliveryHealth(connection: Connection) {
  const Model = getOrderNotificationModel(connection);
  const [pending, inFlight, dead] = await Promise.all([
    Model.countDocuments({ channel: "whatsapp", state: "pending" }),
    Model.countDocuments({ channel: "whatsapp", state: "in_flight" }),
    Model.countDocuments({ channel: "whatsapp", state: "dead" }),
  ]);
  return { pending, inFlight, dead };
}
