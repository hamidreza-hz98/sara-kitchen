import { Mongoose, Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  getTransactionModel,
  TRANSACTION_APPEND_ONLY_ERROR,
  TRANSACTION_INDEX_NAMES,
} from "@/server/modules/transactions/model/transaction";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

describe("persisted transaction model", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-transaction-model-test");
    client = new Mongoose();
    await client.connect(database.uri);
    await getTransactionModel(client.connection).syncIndexes();
  }, 120_000);

  afterAll(async () => {
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  const input = (digest: string, paymentId: string | null = null) => ({
    orderId: new Types.ObjectId(),
    customerId: new Types.ObjectId(),
    method: "mbway" as const,
    provider: "mbway-sandbox" as const,
    currency: "EUR" as const,
    amounts: { requestedCents: 1200 },
    providerReferences: { paymentId },
    idempotencyKeyHash: digest,
    events: [
      {
        eventKey: "created",
        source: "system" as const,
        status: "created" as const,
        occurredAt: new Date(),
      },
    ],
  });

  it("enforces unique digests and non-null provider payment IDs while allowing pending IDs", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const Transaction = getTransactionModel(client.connection);
    await Transaction.create(input("a".repeat(64)));
    await Transaction.create(input("b".repeat(64)));
    await expect(Transaction.create(input("a".repeat(64)))).rejects.toMatchObject({ code: 11000 });
    await Transaction.create(input("c".repeat(64), "payment_unique"));
    await expect(Transaction.create(input("d".repeat(64), "payment_unique"))).rejects.toMatchObject(
      { code: 11000 },
    );
    expect(await Transaction.collection.indexes()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: TRANSACTION_INDEX_NAMES.idempotency, unique: true }),
        expect.objectContaining({ name: TRANSACTION_INDEX_NAMES.providerPayment, unique: true }),
      ]),
    );
  });

  it("permits appended events and blocks edits, removals, query updates, and deletion", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const Transaction = getTransactionModel(client.connection);
    const record = await Transaction.create(input("e".repeat(64)));
    record.status = "pending";
    record.events.push({
      eventKey: "provider-pending",
      source: "provider",
      status: "pending",
      amountCents: 1200,
      responseCode: "ACCEPTED",
      providerEventId: "evt_pending",
      occurredAt: new Date(),
      recordedAt: new Date(),
    });
    await record.save();

    const reloaded = await Transaction.findById(record._id);
    expect(reloaded?.events).toHaveLength(2);
    if (!reloaded) throw new Error("Transaction disappeared.");
    reloaded.events[0]!.status = "paid";
    await expect(reloaded.save({ validateBeforeSave: false })).rejects.toThrow(
      TRANSACTION_APPEND_ONLY_ERROR,
    );
    await expect(
      Transaction.updateOne({ _id: record._id }, { $set: { status: "paid" } }),
    ).rejects.toThrow(TRANSACTION_APPEND_ONLY_ERROR);
    await expect(Transaction.deleteOne({ _id: record._id })).rejects.toThrow(
      TRANSACTION_APPEND_ONLY_ERROR,
    );
    expect((await Transaction.findById(record._id))?.events).toHaveLength(2);
  });
});
