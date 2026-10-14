import { createHash, createHmac } from "node:crypto";

import { Mongoose, Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getPaymentWebhookEventModel } from "@/server/modules/transactions/model/payment-webhook-event";
import { getTransactionModel } from "@/server/modules/transactions/model/transaction";
import {
  acceptVerifiedMbWayWebhook,
  PaymentWebhookConflictError,
  PaymentWebhookUnmatchedError,
  processReceivedMbWayWebhook,
  receiveVerifiedMbWayWebhook,
} from "@/server/modules/transactions/service/payment-webhook";
import { verifyAndParseMbWaySandboxWebhook } from "@/server/modules/transactions/validation/mbway-sandbox-webhook";

import { startTestMongoReplicaSet, type TestMongoDatabase } from "../helpers/mongodb";

const secret = "local-webhook-test-secret-at-least-32-chars";
const now = new Date("2026-10-14T12:00:00.000Z");
let serial = 0;

function signedEvent(overrides: Record<string, unknown> = {}) {
  serial += 1;
  const body = JSON.stringify({
    paymentId: `payment_${serial}`,
    eventId: `event_${serial}`,
    code: "PAID",
    amountCents: 1_250,
    responseCode: "APPROVED",
    occurredAt: now.toISOString(),
    ...overrides,
  });
  const timestamp = String(Math.floor(now.getTime() / 1_000));
  const signature = `sha256=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
  const verified = verifyAndParseMbWaySandboxWebhook({
    rawBody: body,
    signature,
    timestamp,
    secret,
    now,
  });
  if (!verified) throw new Error("Test event was not verified.");
  return { body, signature, timestamp, verified };
}

describe("MB Way sandbox webhook inbox", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;

  beforeAll(async () => {
    database = await startTestMongoReplicaSet("sara-kitchen-webhook-test");
    client = new Mongoose();
    await client.connect(database.uri);
    await getTransactionModel(client.connection).syncIndexes();
    await getPaymentWebhookEventModel(client.connection).syncIndexes();
  }, 120_000);

  afterAll(async () => {
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  async function createPending(paymentId: string) {
    if (!client) throw new Error("MongoDB was not initialized.");
    return getTransactionModel(client.connection).create({
      orderId: new Types.ObjectId(),
      customerId: new Types.ObjectId(),
      method: "mbway",
      provider: "mbway-sandbox",
      currency: "EUR",
      amounts: { requestedCents: 1_250 },
      status: "pending",
      providerReferences: { paymentId, requestId: `request_${paymentId}` },
      idempotencyKeyHash: createHash("sha256").update(paymentId).digest("hex"),
      events: [
        { eventKey: `created_${paymentId}`, source: "system", status: "created", occurredAt: now },
        {
          eventKey: `pending_${paymentId}`,
          source: "provider",
          status: "pending",
          occurredAt: now,
        },
      ],
    });
  }

  it("authenticates exact raw bytes and rejects tampering, stale timestamps and invalid payloads before persistence", async () => {
    if (!client) throw new Error("MongoDB was not initialized.");
    const event = signedEvent();
    expect(
      verifyAndParseMbWaySandboxWebhook({
        rawBody: event.body.replace("PAID", "FAILED"),
        signature: event.signature,
        timestamp: event.timestamp,
        secret,
        now,
      }),
    ).toBeNull();
    expect(
      verifyAndParseMbWaySandboxWebhook({
        rawBody: event.body,
        signature: event.signature,
        timestamp: event.timestamp,
        secret,
        now: new Date(now.getTime() + 301_000),
      }),
    ).toBeNull();
    const cardLikeBody = event.body.replace(event.verified.paymentId, "4111111111111111");
    const cardLikeSignature = `sha256=${createHmac("sha256", secret).update(`${event.timestamp}.${cardLikeBody}`).digest("hex")}`;
    expect(
      verifyAndParseMbWaySandboxWebhook({
        rawBody: cardLikeBody,
        signature: cardLikeSignature,
        timestamp: event.timestamp,
        secret,
        now,
      }),
    ).toBeNull();
    expect(await getPaymentWebhookEventModel(client.connection).countDocuments()).toBe(0);
  });

  it("persists first, applies once, and rejects conflicting event-ID reuse", async () => {
    if (!client) throw new Error("MongoDB was not initialized.");
    const event = signedEvent();
    const transaction = await createPending(event.verified.paymentId);
    const received = await receiveVerifiedMbWayWebhook(client.connection, event.verified);
    expect(
      (await getPaymentWebhookEventModel(client.connection).findById(received.id))?.status,
    ).toBe("received");
    expect(await processReceivedMbWayWebhook(client.connection, received.id)).toBe("applied");
    expect(await acceptVerifiedMbWayWebhook(client.connection, event.verified)).toBe("duplicate");
    const stored = await getTransactionModel(client.connection).findById(transaction._id);
    expect(stored?.status).toBe("paid");
    expect(stored?.amounts.capturedCents).toBe(1_250);
    expect(stored?.events).toHaveLength(3);
    expect(
      (await getPaymentWebhookEventModel(client.connection).findById(received.id))?.status,
    ).toBe("applied");
    await expect(
      acceptVerifiedMbWayWebhook(client.connection, {
        ...event.verified,
        code: "FAILED",
      }),
    ).rejects.toBeInstanceOf(PaymentWebhookConflictError);
  });

  it("records out-of-order events as ignored without regressing payment state", async () => {
    if (!client) throw new Error("MongoDB was not initialized.");
    const paid = signedEvent();
    const transaction = await createPending(paid.verified.paymentId);
    expect(await acceptVerifiedMbWayWebhook(client.connection, paid.verified)).toBe("applied");
    const pending = signedEvent({
      paymentId: paid.verified.paymentId,
      code: "PENDING",
      amountCents: null,
    });
    expect(await acceptVerifiedMbWayWebhook(client.connection, pending.verified)).toBe("ignored");
    expect((await getTransactionModel(client.connection).findById(transaction._id))?.status).toBe(
      "paid",
    );
    expect(
      await getPaymentWebhookEventModel(client.connection).findOne({
        providerEventId: pending.verified.eventId,
        status: "ignored",
        ignoreReason: "out-of-order",
      }),
    ).not.toBeNull();
  });

  it("rolls back payment and outcome together, leaving the received event retryable", async () => {
    if (!client) throw new Error("MongoDB was not initialized.");
    const event = signedEvent();
    const transaction = await createPending(event.verified.paymentId);
    const received = await receiveVerifiedMbWayWebhook(client.connection, event.verified);
    await expect(
      processReceivedMbWayWebhook(client.connection, received.id, {
        beforeComplete: async () => {
          throw new Error("injected failure");
        },
      }),
    ).rejects.toThrow();
    expect((await getTransactionModel(client.connection).findById(transaction._id))?.status).toBe(
      "pending",
    );
    expect(
      (await getPaymentWebhookEventModel(client.connection).findById(received.id))?.status,
    ).toBe("received");
    expect(await acceptVerifiedMbWayWebhook(client.connection, event.verified)).toBe("applied");
  });

  it("keeps an unmatched verified event for later retry", async () => {
    if (!client) throw new Error("MongoDB was not initialized.");
    const event = signedEvent();
    await expect(
      acceptVerifiedMbWayWebhook(client.connection, event.verified),
    ).rejects.toBeInstanceOf(PaymentWebhookUnmatchedError);
    const saved = await getPaymentWebhookEventModel(client.connection).findOne({
      providerEventId: event.verified.eventId,
    });
    expect(saved?.status).toBe("received");
    await createPending(event.verified.paymentId);
    expect(await acceptVerifiedMbWayWebhook(client.connection, event.verified)).toBe("applied");
  });
});
