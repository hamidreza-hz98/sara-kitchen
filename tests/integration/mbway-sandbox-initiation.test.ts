import { createHash } from "node:crypto";

import { Mongoose, Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getTransactionModel } from "@/server/modules/transactions/model/transaction";
import { planTransactionTransition } from "@/server/modules/transactions/policy/transaction-state-machine";
import { persistMbWaySandboxInitiation } from "@/server/modules/transactions/service/mbway-sandbox-initiation";
import type { ProviderPaymentStatus } from "@/server/modules/transactions/provider/payment-provider";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

const key = "mbway-init-key-1";
const observedAt = new Date("2026-10-14T12:00:00.000Z");
const response: ProviderPaymentStatus = {
  providerPaymentId: "mbway_payment_1",
  providerRequestId: "mbway_request_1",
  currency: "EUR",
  status: "pending",
  amounts: { requestedCents: 1_250, authorizedCents: 0, capturedCents: 0, refundedCents: 0 },
  observedAt,
};

describe("MB Way sandbox provider reference recording", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-mbway-init-test");
    client = new Mongoose();
    await client.connect(database.uri);
    await getTransactionModel(client.connection).syncIndexes();
  }, 120_000);

  afterAll(async () => {
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  async function createTransaction(overrides: Record<string, unknown> = {}) {
    if (!client) throw new Error("MongoDB was not initialized.");
    const Transaction = getTransactionModel(client.connection);
    return Transaction.create({
      orderId: new Types.ObjectId(),
      customerId: new Types.ObjectId(),
      method: "mbway",
      provider: "mbway-sandbox",
      currency: "EUR",
      amounts: { requestedCents: 1_250 },
      idempotencyKeyHash: createHash("sha256").update(key).digest("hex"),
      events: [
        { eventKey: "created-1", source: "system", status: "created", occurredAt: observedAt },
      ],
      ...overrides,
    });
  }

  it("stores only safe references and the pending event, with idempotent replay", async () => {
    if (!client) throw new Error("MongoDB was not initialized.");
    const transaction = await createTransaction();
    const input = { transactionId: transaction._id.toHexString(), idempotencyKey: key, response };
    expect(await persistMbWaySandboxInitiation(client.connection, input)).toEqual({
      transactionId: input.transactionId,
      providerPaymentId: response.providerPaymentId,
      providerRequestId: response.providerRequestId,
      status: "pending",
    });
    expect(await persistMbWaySandboxInitiation(client.connection, input)).toMatchObject({
      status: "pending",
    });
    const stored = await getTransactionModel(client.connection).collection.findOne({
      _id: transaction._id,
    });
    expect(stored?.status).toBe("pending");
    expect(stored?.events).toHaveLength(2);
    expect(stored?.providerReferences).toEqual({
      paymentId: "mbway_payment_1",
      requestId: "mbway_request_1",
    });
    expect(JSON.stringify(stored)).not.toMatch(/payerMobile|912345678|mbway-init-key-1/u);

    const paid = await getTransactionModel(client.connection)
      .findById(transaction._id)
      .select("+providerReferences");
    if (!paid) throw new Error("Transaction disappeared.");
    const transition = planTransactionTransition(
      {
        requestedCents: paid.amounts.requestedCents,
        amounts: paid.amounts,
        status: paid.status,
        events: paid.events,
      },
      {
        kind: "payment.captured",
        eventKey: "provider:paid-1",
        providerEventId: "paid-1",
        amountCents: 1_250,
        occurredAt: observedAt,
        source: "provider",
      },
    );
    paid.status = transition.status;
    paid.amounts = transition.amounts;
    paid.events.push(transition.event);
    await paid.save();
    expect((await persistMbWaySandboxInitiation(client.connection, input)).status).toBe("paid");
  });

  it("rejects mismatched key, amount, provider, and conflicting references without partial writes", async () => {
    if (!client) throw new Error("MongoDB was not initialized.");
    const validKey = "mbway-init-key-2";
    const secondResponse = {
      ...response,
      providerPaymentId: "mbway_payment_2",
      providerRequestId: "mbway_request_2",
    };
    const transaction = await createTransaction({
      idempotencyKeyHash: createHash("sha256").update(validKey).digest("hex"),
    });
    const transactionId = transaction._id.toHexString();
    await expect(
      persistMbWaySandboxInitiation(client.connection, {
        transactionId,
        idempotencyKey: "wrong-key-1",
        response: secondResponse,
      }),
    ).rejects.toMatchObject({ code: "conflict" });
    await expect(
      persistMbWaySandboxInitiation(client.connection, {
        transactionId,
        idempotencyKey: validKey,
        response: { ...secondResponse, amounts: { ...response.amounts, requestedCents: 1_251 } },
      }),
    ).rejects.toMatchObject({ code: "conflict" });
    expect((await getTransactionModel(client.connection).findById(transactionId))?.status).toBe(
      "created",
    );

    await persistMbWaySandboxInitiation(client.connection, {
      transactionId,
      idempotencyKey: validKey,
      response: secondResponse,
    });
    await expect(
      persistMbWaySandboxInitiation(client.connection, {
        transactionId,
        idempotencyKey: validKey,
        response: { ...secondResponse, providerPaymentId: "different_payment_1" },
      }),
    ).rejects.toMatchObject({ code: "conflict" });

    const wrongProvider = await createTransaction({
      provider: "paypal",
      method: "paypal",
      idempotencyKeyHash: createHash("sha256").update("another-key-1").digest("hex"),
    });
    await expect(
      persistMbWaySandboxInitiation(client.connection, {
        transactionId: wrongProvider._id.toHexString(),
        idempotencyKey: "another-key-1",
        response,
      }),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("rejects a card-like numeric provider reference before database mutation", async () => {
    if (!client) throw new Error("MongoDB was not initialized.");
    const transaction = await createTransaction({
      idempotencyKeyHash: createHash("sha256").update("mbway-init-key-3").digest("hex"),
    });
    await expect(
      persistMbWaySandboxInitiation(client.connection, {
        transactionId: transaction._id.toHexString(),
        idempotencyKey: "mbway-init-key-3",
        response: { ...response, providerPaymentId: "4111111111111111" },
      }),
    ).rejects.toMatchObject({ code: "invalid-request" });
    expect((await getTransactionModel(client.connection).findById(transaction._id))?.status).toBe(
      "created",
    );
  });
});
