import { Mongoose, Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  getOrderModel,
  ORDER_HISTORY_APPEND_ONLY_ERROR,
  ORDER_INDEX_NAMES,
  ORDER_SNAPSHOT_IMMUTABLE_ERROR,
} from "@/server/modules/orders/model/order";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";
import { validOrder } from "../helpers/order";

describe("persisted order model", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-order-model-test");
    client = new Mongoose();
    await client.connect(database.uri);
    await getOrderModel(client.connection).syncIndexes();
  }, 120_000);

  afterAll(async () => {
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  it("enforces code uniqueness, customer/status lookups, and no TTL", async () => {
    if (!client) throw new Error("MongoDB did not start.");
    const Order = getOrderModel(client.connection);
    const first = await Order.create(validOrder());
    await expect(Order.create(validOrder({ code: first.code }))).rejects.toMatchObject({
      code: 11000,
    });
    const indexes = await Order.collection.indexes();
    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: ORDER_INDEX_NAMES.code, unique: true }),
        expect.objectContaining({ name: ORDER_INDEX_NAMES.customer }),
        expect.objectContaining({ name: ORDER_INDEX_NAMES.status }),
      ]),
    );
    expect(indexes.every((index) => index.expireAfterSeconds === undefined)).toBe(true);
  });

  it("keeps original item, customer, address and price facts after source records change", async () => {
    if (!client) throw new Error("MongoDB did not start.");
    const Order = getOrderModel(client.connection);
    const base = validOrder();
    const addressId = new Types.ObjectId();
    const address = {
      name: "Home",
      recipientName: "Sara Kazemi",
      recipientMobile: "+351912345678",
      formattedAddress: "Rua do Porto 12, Porto",
      postalCode: "4000-001",
      location: { type: "Point", coordinates: [-8.611, 41.15] },
      deliveryNotes: "Front door",
    };
    const order = await Order.create(
      validOrder({
        addressId,
        addressSnapshot: address,
        fulfillment: { ...base.fulfillment, method: "delivery" },
        pricing: {
          ...base.pricing,
          deliveryFeeCents: 300,
          totalCents: 2_100,
          delivery: { distanceMeters: 1_500, baseFeeCents: 300, freeDeliveryApplied: false },
        },
      }),
    );
    await client.connection.collection("dishes").insertOne({
      _id: order.items[0]!.dishId,
      translations: [{ locale: "en", name: "Fesenjan" }],
      basePriceCents: 1_000,
    });
    await client.connection.collection("customers").insertOne({
      _id: order.customerId,
      firstName: "Sara",
      mobile: "+351912345678",
    });
    await client.connection.collection("addresses").insertOne({
      _id: addressId,
      formattedAddress: address.formattedAddress,
    });
    await client.connection.collection("dishes").updateOne(
      { _id: order.items[0]!.dishId },
      {
        $set: { translations: [{ locale: "en", name: "Renamed" }], basePriceCents: 9_999 },
      },
    );
    await client.connection.collection("customers").updateOne(
      { _id: order.customerId },
      {
        $set: { firstName: "Changed", mobile: "+351999999999" },
      },
    );
    await client.connection.collection("addresses").updateOne(
      { _id: addressId },
      {
        $set: { formattedAddress: "New place" },
      },
    );
    const stored = await Order.findById(order._id);
    expect(stored?.items[0]).toMatchObject({
      name: "Fesenjan",
      baseUnitPriceCents: 1_000,
      lineSubtotalCents: 1_800,
    });
    expect(stored?.customerSnapshot).toMatchObject({ firstName: "Sara", mobile: "+351912345678" });
    expect(stored?.addressSnapshot?.formattedAddress).toBe("Rua do Porto 12, Porto");
    expect(stored?.pricing.totalCents).toBe(2_100);
  });

  it("appends lifecycle data while blocking snapshot edits and history rewrites", async () => {
    if (!client) throw new Error("MongoDB did not start.");
    const Order = getOrderModel(client.connection);
    const order = await Order.create(validOrder());
    order.status = "confirmed";
    order.revision = 2;
    order.statusHistory.push({
      eventKey: "confirmed-2",
      status: "confirmed",
      actorKind: "system",
      actorId: null,
      reasonCode: "payment_confirmed",
      paymentStatus: "paid",
      occurredAt: new Date(),
      recordedAt: new Date(),
    });
    order.transactionIds.push(new Types.ObjectId());
    await order.save();
    expect((await Order.findById(order._id))?.statusHistory).toHaveLength(2);

    const edited = await Order.findById(order._id);
    if (!edited) throw new Error("Order disappeared.");
    edited.items[0]!.name = "Tampered";
    await expect(edited.save({ validateBeforeSave: false })).rejects.toThrow(
      ORDER_SNAPSHOT_IMMUTABLE_ERROR,
    );

    const history = await Order.findById(order._id);
    if (!history) throw new Error("Order disappeared.");
    history.statusHistory[0]!.reasonCode = "changed";
    await expect(history.save({ validateBeforeSave: false })).rejects.toThrow(
      ORDER_HISTORY_APPEND_ONLY_ERROR,
    );
    await expect(
      Order.updateOne({ _id: order._id }, { $set: { "pricing.totalCents": 1 } }),
    ).rejects.toThrow(ORDER_SNAPSHOT_IMMUTABLE_ERROR);
    await expect(Order.deleteOne({ _id: order._id })).rejects.toThrow(
      ORDER_SNAPSHOT_IMMUTABLE_ERROR,
    );
  });

  it("replays payment-coupled transitions on save even when validation is skipped", async () => {
    if (!client) throw new Error("MongoDB did not start.");
    const Order = getOrderModel(client.connection);
    const order = await Order.create(validOrder());
    order.status = "confirmed";
    order.revision = 2;
    order.statusHistory.push({
      eventKey: "forged-confirmation",
      status: "confirmed",
      actorKind: "admin",
      actorId: new Types.ObjectId(),
      reasonCode: null,
      paymentStatus: "pending",
      occurredAt: new Date(),
      recordedAt: new Date(),
    });
    await expect(order.save({ validateBeforeSave: false })).rejects.toThrow(/settled payment/u);
    const persisted = await Order.collection.findOne({ _id: order._id });
    expect(persisted).toMatchObject({ status: "pending_payment", currency: "EUR" });

    const valid = await Order.findById(order._id);
    if (!valid) throw new Error("Order disappeared.");
    valid.status = "confirmed";
    valid.revision = 2;
    valid.statusHistory.push({
      eventKey: "paid-confirmation",
      status: "confirmed",
      actorKind: "system",
      actorId: null,
      reasonCode: "payment_confirmed",
      paymentStatus: "paid",
      occurredAt: new Date(),
      recordedAt: new Date(),
    });
    await valid.save();
    expect((await Order.findById(order._id))?.status).toBe("confirmed");
  });

  it("persists pickup completion, partial-refund sync, then full refund without losing fulfillment history", async () => {
    if (!client) throw new Error("MongoDB did not start.");
    const Order = getOrderModel(client.connection);
    const order = await Order.create(validOrder());
    const adminId = new Types.ObjectId();
    const observedAt = new Date("2026-10-14T12:00:00.000Z");
    const steps = [
      {
        status: "confirmed",
        actorKind: "system",
        actorId: null,
        paymentStatus: "paid",
        reasonCode: "payment_confirmed",
      },
      {
        status: "preparing",
        actorKind: "admin",
        actorId: adminId,
        paymentStatus: "paid",
        reasonCode: null,
      },
      {
        status: "ready",
        actorKind: "admin",
        actorId: adminId,
        paymentStatus: "paid",
        reasonCode: null,
      },
      {
        status: "completed",
        actorKind: "admin",
        actorId: adminId,
        paymentStatus: "paid",
        reasonCode: null,
      },
      {
        status: "completed",
        actorKind: "system",
        actorId: null,
        paymentStatus: "partially-refunded",
        reasonCode: "payment_partial_refund",
      },
      {
        status: "refunded",
        actorKind: "system",
        actorId: null,
        paymentStatus: "refunded",
        reasonCode: "refund_completed",
      },
    ] as const;
    for (const [index, step] of steps.entries()) {
      order.statusHistory.push({
        eventKey: `step-${index + 1}`,
        ...step,
        occurredAt: observedAt,
        recordedAt: observedAt,
      });
    }
    order.status = "refunded";
    order.revision = order.statusHistory.length;
    order.fulfillment.completedAt = observedAt;
    await order.save();
    const stored = await Order.findById(order._id);
    expect(stored?.status).toBe("refunded");
    expect(stored?.statusHistory.map((event) => event.status)).toEqual([
      "pending_payment",
      "confirmed",
      "preparing",
      "ready",
      "completed",
      "completed",
      "refunded",
    ]);
    expect(stored?.fulfillment.completedAt).toEqual(observedAt);
  });
});
