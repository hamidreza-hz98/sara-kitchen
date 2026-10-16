import { Mongoose, Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getOrderModel } from "@/server/modules/orders/model/order";
import { getCustomerOrderDetail } from "@/server/modules/orders/service/customer-order-detail";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";
import { validOrder } from "../helpers/order";

describe("customer order detail", () => {
  let database: TestMongoDatabase;
  let client: Mongoose;
  let ownerId: string;
  let code: string;

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-customer-order-detail-test");
    client = new Mongoose();
    await client.connect(database.uri);
    const order = await getOrderModel(client.connection).create(validOrder());
    ownerId = order.customerId.toString();
    code = order.code;
    await client.connection.collection("transactions").insertOne({
      _id: order.transactionIds[0]!,
      orderId: order._id,
      customerId: order.customerId,
      currency: "EUR",
      status: "pending",
      amounts: { requestedCents: 1_800 },
    });
  }, 120_000);

  afterAll(async () => {
    await client?.disconnect();
    await database?.stop();
  });

  it("returns original purchase facts, timeline, and verified payment without internal fields", async () => {
    const detail = await getCustomerOrderDetail(client.connection, ownerId, code);
    expect(detail).toMatchObject({
      code,
      status: "pending_payment",
      paymentStatus: "pending",
      canCancel: false,
      canStartNewOrder: false,
      customerName: "Sara Kazemi",
      items: [
        {
          name: "Fesenjan",
          quantity: 2,
          baseUnitPriceCents: 1_000,
          effectiveUnitPriceCents: 900,
          lineSubtotalCents: 1_800,
        },
      ],
      pricing: { subtotalCents: 2_000, discountCents: 200, totalCents: 1_800 },
      history: [{ status: "pending_payment", paymentStatus: "pending" }],
    });
    expect(JSON.stringify(detail)).not.toMatch(/internalNote|transactionIds|actorId|providerKey/u);
  });

  it("never resolves another customer's code or a malformed code", async () => {
    await expect(
      getCustomerOrderDetail(client.connection, new Types.ObjectId().toString(), code),
    ).resolves.toBeNull();
    await expect(getCustomerOrderDetail(client.connection, ownerId, "bad")).resolves.toBeNull();
  });

  it("only offers customer cancellation after verified provider cancellation", async () => {
    const order = await getOrderModel(client.connection).findOne({ code });
    await client.connection
      .collection("transactions")
      .updateOne({ _id: order!.transactionIds[0]! }, { $set: { status: "cancelled" } });
    const detail = await getCustomerOrderDetail(client.connection, ownerId, code);
    expect(detail?.canCancel).toBe(true);
    await client.connection
      .collection("transactions")
      .updateOne({ _id: order!.transactionIds[0]! }, { $set: { "amounts.requestedCents": 999 } });
    const mismatched = await getCustomerOrderDetail(client.connection, ownerId, code);
    expect(mismatched?.paymentStatus).toBe("unknown");
    expect(mismatched?.canCancel).toBe(false);
  });
});
