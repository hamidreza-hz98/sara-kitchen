import { Mongoose, Schema } from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  MongoTransactionUnavailableError,
  withMongoTransaction,
} from "@/server/database/transaction-boundary";

import {
  startTestMongoDatabase,
  startTestMongoReplicaSet,
  type TestMongoDatabase,
} from "../helpers/mongodb";

describe("checkout transaction boundary", () => {
  let replica: TestMongoDatabase;
  let client: Mongoose;

  beforeAll(async () => {
    replica = await startTestMongoReplicaSet();
    client = new Mongoose();
    await client.connect(replica.uri);
  }, 120_000);

  afterAll(async () => {
    await client?.disconnect();
    await replica?.stop();
  });

  it("rolls back order, payment intent and outbox on failures at each write boundary", async () => {
    const Order = client.model(
      "TxnOrder",
      new Schema({ code: { type: String, unique: true }, status: String }),
    );
    const Payment = client.model("TxnPayment", new Schema({ orderCode: String, state: String }));
    const Outbox = client.model("TxnOutbox", new Schema({ orderCode: String }));
    await Promise.all([
      Order.createCollection(),
      Payment.createCollection(),
      Outbox.createCollection(),
    ]);

    async function checkout(code: string, failAfter?: "order" | "payment" | "outbox") {
      return withMongoTransaction(client.connection, async (session) => {
        await Order.create([{ code, status: "pending" }], { session });
        if (failAfter === "order") throw new Error("injected: order");
        await Payment.create([{ orderCode: code, state: "initiated" }], { session });
        if (failAfter === "payment") throw new Error("injected: payment");
        await Outbox.create([{ orderCode: code }], { session });
        if (failAfter === "outbox") throw new Error("injected: outbox");
        return code;
      });
    }

    for (const [index, point] of (["order", "payment", "outbox"] as const).entries()) {
      const code = `SK-FAIL-${index}`;
      await expect(checkout(code, point)).rejects.toThrow(`injected: ${point}`);
      expect(await Order.countDocuments({ code })).toBe(0);
      expect(await Payment.countDocuments({ orderCode: code })).toBe(0);
      expect(await Outbox.countDocuments({ orderCode: code })).toBe(0);
    }

    await expect(checkout("SK-SUCCESS")).resolves.toBe("SK-SUCCESS");
    expect(await Order.countDocuments({ code: "SK-SUCCESS" })).toBe(1);
    expect(await Payment.countDocuments({ orderCode: "SK-SUCCESS" })).toBe(1);
    expect(await Outbox.countDocuments({ orderCode: "SK-SUCCESS" })).toBe(1);

    await expect(
      withMongoTransaction(client.connection, async (session) => {
        await Payment.updateOne({ orderCode: "SK-SUCCESS" }, { state: "paid" }, { session });
        await Order.updateOne({ code: "SK-SUCCESS" }, { status: "paid" }, { session });
        throw new Error("injected: webhook transition");
      }),
    ).rejects.toThrow("injected: webhook transition");
    expect((await Payment.findOne({ orderCode: "SK-SUCCESS" }).lean())?.state).toBe("initiated");
    expect((await Order.findOne({ code: "SK-SUCCESS" }).lean())?.status).toBe("pending");
  });
});

describe("standalone checkout safety", () => {
  let database: TestMongoDatabase;
  let client: Mongoose;

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-standalone-transaction-test");
    client = new Mongoose();
    await client.connect(database.uri);
  }, 120_000);

  afterAll(async () => {
    await client?.disconnect();
    await database?.stop();
  });

  it("rejects the workflow before any write or provider call", async () => {
    const Order = client.model("StandaloneOrder", new Schema({ code: String }));
    let callbackRan = false;
    await expect(
      withMongoTransaction(client.connection, async (session) => {
        callbackRan = true;
        await Order.create([{ code: "SK-NOPE" }], { session });
      }),
    ).rejects.toBeInstanceOf(MongoTransactionUnavailableError);
    expect(callbackRan).toBe(false);
    expect(await Order.countDocuments()).toBe(0);
  });
});
