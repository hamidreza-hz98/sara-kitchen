import { Mongoose, Types } from "mongoose";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  getTransactionModel,
  TRANSACTION_APPEND_ONLY_ERROR,
  TRANSACTION_INDEX_NAMES,
} from "@/server/modules/transactions/model/transaction";

const client = new Mongoose();
const Transaction = getTransactionModel(client.connection);

function validTransaction(overrides: Record<string, unknown> = {}) {
  return new Transaction({
    orderId: new Types.ObjectId(),
    customerId: new Types.ObjectId(),
    method: "mbway",
    provider: "mbway-sandbox",
    currency: "EUR",
    amounts: { requestedCents: 10_000 },
    idempotencyKeyHash: "a".repeat(64),
    events: [
      {
        eventKey: "created-1",
        source: "system",
        status: "created",
        occurredAt: new Date("2026-10-14T10:00:00.000Z"),
      },
    ],
    ...overrides,
  });
}

describe("transaction model", () => {
  it("validates a provider-neutral EUR transaction without serializing private references", async () => {
    const transaction = validTransaction({
      providerReferences: { paymentId: "sandbox_payment_1", requestId: "sandbox_request_1" },
    });
    await expect(transaction.validate()).resolves.toBeUndefined();
    expect(transaction.currency).toBe("EUR");
    expect(transaction.status).toBe("created");
    expect(transaction.amounts).toMatchObject({
      requestedCents: 10_000,
      authorizedCents: 0,
      capturedCents: 0,
      refundedCents: 0,
    });
    expect(transaction.toJSON()).not.toHaveProperty("idempotencyKeyHash");
    expect(transaction.toJSON()).not.toHaveProperty("providerReferences");
    expect(Transaction.schema.path("idempotencyKeyHash").options.select).toBe(false);
  });

  it("accepts future methods only with their compatible provider", async () => {
    for (const [method, provider] of [
      ["paypal", "paypal"],
      ["card", "card-gateway"],
      ["cash", "manual"],
    ]) {
      await expect(validTransaction({ method, provider }).validate()).resolves.toBeUndefined();
    }
    await expect(
      validTransaction({ method: "card", provider: "mbway-sandbox" }).validate(),
    ).rejects.toMatchObject({ errors: expect.objectContaining({ provider: expect.anything() }) });
  });

  it("rejects fractions, negative amounts, over-capture, and over-refund", async () => {
    for (const amounts of [
      { requestedCents: 1.5 },
      { requestedCents: -1 },
      { requestedCents: 100, authorizedCents: 101 },
      { requestedCents: 100, capturedCents: 101 },
      { requestedCents: 100, capturedCents: 50, refundedCents: 51 },
    ]) {
      await expect(validTransaction({ amounts }).validate()).rejects.toThrow();
    }
  });

  it("requires unique, bounded event data and a digest rather than a raw idempotency key", async () => {
    const duplicate = validTransaction();
    duplicate.events.push({
      eventKey: "created-1",
      source: "system",
      status: "created",
      amountCents: null,
      responseCode: null,
      providerEventId: null,
      occurredAt: new Date("2026-10-14T10:00:00.000Z"),
      recordedAt: new Date(),
    });
    await expect(duplicate.validate()).rejects.toMatchObject({
      errors: expect.objectContaining({ events: expect.anything() }),
    });
    await expect(validTransaction({ idempotencyKeyHash: "raw-key" }).validate()).rejects.toThrow();
    await expect(
      validTransaction({ responseCode: "secret in message" }).validate(),
    ).rejects.toThrow();
    await expect(
      validTransaction({ providerReferences: { paymentId: "4111111111111111" } }).validate(),
    ).rejects.toThrow();
  });

  it("rejects unknown root payment fields and never persists nested unknown fields", () => {
    expect(() => validTransaction({ cardNumber: "4111111111111111" })).toThrow();
    const transaction = validTransaction({ providerReferences: { secret: "unsafe" } });
    expect(transaction.toObject().providerReferences).not.toHaveProperty("secret");
  });

  it("protects existing event prefixes from edits and removals", async () => {
    const persisted = Transaction.hydrate(validTransaction().toObject());
    await expect(persisted.validate()).resolves.toBeUndefined();
    persisted.events[0]!.status = "paid";
    await expect(persisted.validate()).rejects.toMatchObject({
      errors: expect.objectContaining({ events: expect.anything() }),
    });

    const appended = Transaction.hydrate(validTransaction().toObject());
    appended.events.push({
      eventKey: "pending-2",
      source: "provider",
      status: "pending",
      amountCents: 10_000,
      responseCode: "ACCEPTED",
      providerEventId: "evt_2",
      occurredAt: new Date("2026-10-14T10:01:00.000Z"),
      recordedAt: new Date("2026-10-14T10:01:01.000Z"),
    });
    appended.status = "pending";
    await expect(appended.validate()).resolves.toBeUndefined();
    expect(TRANSACTION_APPEND_ONLY_ERROR).toMatch(/append-only/u);
  });

  it("defines unique idempotency and partial provider payment indexes", () => {
    const indexes = Transaction.schema.indexes();
    expect(indexes).toEqual(
      expect.arrayContaining([
        [
          { idempotencyKeyHash: 1 },
          expect.objectContaining({ name: TRANSACTION_INDEX_NAMES.idempotency, unique: true }),
        ],
        [
          { provider: 1, "providerReferences.paymentId": 1 },
          expect.objectContaining({
            name: TRANSACTION_INDEX_NAMES.providerPayment,
            unique: true,
            partialFilterExpression: { "providerReferences.paymentId": { $type: "string" } },
          }),
        ],
      ]),
    );
  });
});
