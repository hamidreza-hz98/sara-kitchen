import { Mongoose, Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getCustomerPaymentResult, PaymentResultError } from "@/server/modules/orders";
import { getOrderModel } from "@/server/modules/orders/model/order";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";
import { validOrder } from "../helpers/order";

describe("customer payment result", () => {
  let database: TestMongoDatabase;
  let client: Mongoose;

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-payment-result-test");
    client = new Mongoose();
    await client.connect(database.uri);
    await getOrderModel(client.connection).syncIndexes();
  }, 120_000);

  afterAll(async () => {
    await client?.disconnect();
    await database?.stop();
  });

  beforeEach(async () => {
    await Promise.all([
      client.connection.collection("orders").deleteMany({}),
      client.connection.collection("transactions").deleteMany({}),
    ]);
  });

  async function fixture(paymentStatus: string = "pending") {
    const transactionId = new Types.ObjectId();
    const order = await getOrderModel(client.connection).create(
      validOrder({ transactionIds: [transactionId] }),
    );
    await client.connection.collection("transactions").insertOne({
      _id: transactionId,
      orderId: order._id,
      customerId: order.customerId,
      currency: "EUR",
      amounts: { requestedCents: 1_800 },
      status: paymentStatus,
    });
    return order;
  }

  it("returns pending from authoritative records and rejects a different customer", async () => {
    const order = await fixture();
    const result = await getCustomerPaymentResult(
      client.connection,
      order.customerId.toString(),
      order.code,
    );
    expect(result).toMatchObject({
      state: "pending",
      paymentStatus: "pending",
      pollAfterMs: 2_500,
    });
    await expect(
      getCustomerPaymentResult(client.connection, new Types.ObjectId().toString(), order.code),
    ).rejects.toBeInstanceOf(PaymentResultError);
  });

  it("does not report success until both payment and order are confirmed", async () => {
    const order = await fixture("paid");
    expect(
      (await getCustomerPaymentResult(client.connection, order.customerId.toString(), order.code))
        .state,
    ).toBe("pending");
    await client.connection
      .collection("orders")
      .updateOne(
        { _id: order._id },
        { $set: { status: "confirmed", updatedAt: new Date("2026-10-16T08:00:00.000Z") } },
      );
    const confirmed = await getCustomerPaymentResult(
      client.connection,
      order.customerId.toString(),
      order.code,
    );
    expect(confirmed).toMatchObject({
      state: "success",
      paymentStatus: "paid",
      orderStatus: "confirmed",
      pollAfterMs: null,
      canStartNewOrder: false,
    });
  });

  it.each([
    ["failed", "payment_failed", "failed"],
    ["expired", "expired", "expired"],
    ["cancelled", "cancelled", "cancelled"],
    ["refunded", "refunded", "refunded"],
  ] as const)("maps %s records to %s guidance", async (paymentStatus, orderStatus, state) => {
    const order = await fixture(paymentStatus);
    await client.connection
      .collection("orders")
      .updateOne({ _id: order._id }, { $set: { status: orderStatus } });
    const result = await getCustomerPaymentResult(
      client.connection,
      order.customerId.toString(),
      order.code,
    );
    expect(result.state).toBe(state);
    expect(result.canStartNewOrder).toBe(state !== "refunded");
  });
});
