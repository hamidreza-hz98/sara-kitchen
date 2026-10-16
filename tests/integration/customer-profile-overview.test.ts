import { Mongoose, Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { readCustomerProfileOrders } from "@/server/modules/orders";
import { getOrderModel } from "@/server/modules/orders/model/order";
import { readCustomerLifetimeSpend } from "@/server/modules/transactions";
import { getTransactionModel } from "@/server/modules/transactions/model/transaction";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

describe("private customer profile overview", () => {
  let database: TestMongoDatabase;
  let client: Mongoose;

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-profile-overview-test");
    client = new Mongoose();
    await client.connect(database.uri);
    await Promise.all([
      getOrderModel(client.connection).syncIndexes(),
      getTransactionModel(client.connection).syncIndexes(),
    ]);
  }, 120_000);

  afterAll(async () => {
    await client?.disconnect();
    await database?.stop();
  });

  it("shows all created orders, the latest snapshot, and net verified spend only for the owner", async () => {
    const owner = new Types.ObjectId();
    const other = new Types.ObjectId();
    const paidOrderId = new Types.ObjectId();
    const pendingOrderId = new Types.ObjectId();
    const otherOrderId = new Types.ObjectId();
    await client.connection.collection("orders").insertMany([
      {
        _id: paidOrderId,
        customerId: owner,
        code: "SK-PROFILE1",
        status: "confirmed",
        pricing: { totalCents: 2_000 },
        createdAt: new Date("2026-09-01T10:00:00Z"),
      },
      {
        _id: pendingOrderId,
        customerId: owner,
        code: "SK-PROFILE2",
        status: "pending_payment",
        pricing: { totalCents: 4_000 },
        createdAt: new Date("2026-10-01T10:00:00Z"),
      },
      {
        _id: otherOrderId,
        customerId: other,
        code: "SK-OTHER1",
        status: "completed",
        pricing: { totalCents: 90_000 },
        createdAt: new Date("2026-10-15T10:00:00Z"),
      },
    ]);
    await client.connection.collection("transactions").insertMany([
      {
        customerId: owner,
        orderId: paidOrderId,
        idempotencyKeyHash: "profile-paid-fixture",
        events: [
          { status: "pending", amountCents: null },
          { status: "paid", amountCents: 2_000 },
          { status: "partially-refunded", amountCents: 500 },
        ],
      },
      {
        customerId: owner,
        orderId: pendingOrderId,
        idempotencyKeyHash: "profile-pending-fixture",
        events: [{ status: "pending", amountCents: null }],
      },
      {
        customerId: other,
        orderId: otherOrderId,
        idempotencyKeyHash: "profile-other-fixture",
        events: [{ status: "paid", amountCents: 90_000 }],
      },
    ]);

    await expect(readCustomerProfileOrders(client.connection, owner.toString())).resolves.toEqual({
      totalOrders: 2,
      latestOrder: {
        code: "SK-PROFILE2",
        status: "pending_payment",
        createdAt: "2026-10-01T10:00:00.000Z",
        totalCents: 4_000,
      },
    });
    await expect(readCustomerLifetimeSpend(client.connection, owner.toString())).resolves.toEqual({
      grossCents: 2_000,
      refundsCents: 500,
      netCents: 1_500,
    });
  });

  it("returns a zero state for a customer without orders or captures", async () => {
    const empty = new Types.ObjectId().toString();
    await expect(readCustomerProfileOrders(client.connection, empty)).resolves.toEqual({
      totalOrders: 0,
      latestOrder: null,
    });
    await expect(readCustomerLifetimeSpend(client.connection, empty)).resolves.toEqual({
      grossCents: 0,
      refundsCents: 0,
      netCents: 0,
    });
  });

  it("rejects malformed customer IDs before querying", async () => {
    await expect(readCustomerProfileOrders(client.connection, "not-an-id")).rejects.toThrow(
      RangeError,
    );
    await expect(readCustomerLifetimeSpend(client.connection, "not-an-id")).rejects.toThrow(
      RangeError,
    );
  });
});
