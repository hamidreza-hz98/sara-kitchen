import { Mongoose, Types } from "mongoose";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  getOrderModel,
  ORDER_HISTORY_APPEND_ONLY_ERROR,
  ORDER_INDEX_NAMES,
  ORDER_SNAPSHOT_IMMUTABLE_ERROR,
} from "@/server/modules/orders/model/order";
import { generateOrderCode, ORDER_CODE_PATTERN } from "@/server/modules/orders/policy/order-code";

import { validOrder } from "../helpers/order";

const Order = getOrderModel(new Mongoose().connection);

describe("order model", () => {
  it("generates high-entropy human codes and defines durable lookup indexes", () => {
    const codes = Array.from({ length: 1_000 }, generateOrderCode);
    expect(codes.every((code) => ORDER_CODE_PATTERN.test(code))).toBe(true);
    expect(new Set(codes).size).toBe(codes.length);
    expect(Order.schema.indexes()).toEqual(
      expect.arrayContaining([
        [{ code: 1 }, expect.objectContaining({ name: ORDER_INDEX_NAMES.code, unique: true })],
        [
          { customerId: 1, createdAt: -1, _id: -1 },
          expect.objectContaining({ name: ORDER_INDEX_NAMES.customer }),
        ],
      ]),
    );
  });

  it("validates a full EUR purchase snapshot and serializes the selected locale", async () => {
    const order = new Order(validOrder());
    await expect(order.validate()).resolves.toBeUndefined();
    expect(order.code).toMatch(ORDER_CODE_PATTERN);
    expect(order.toJSON()).toMatchObject({
      locale: "en",
      currency: "EUR",
      pricing: { totalCents: 1_800 },
    });
  });

  it("rejects incoherent line, total, tax, timing, history, and pickup/delivery facts", async () => {
    const base = validOrder();
    const invalid = [
      { items: [{ ...base.items[0]!, lineSubtotalCents: 1_801 }] },
      { pricing: { ...base.pricing, totalCents: 1_799 } },
      { pricing: { ...base.pricing, taxCents: 100, totalCents: 1_900 } },
      { fulfillment: { ...base.fulfillment, leadTimeMinutes: 30 } },
      { status: "completed" },
      { addressId: new Types.ObjectId() },
      { items: [base.items[0], base.items[0]] },
      {
        items: [
          {
            ...base.items[0]!,
            discount: { type: "percentage", amountCents: null, basisPoints: 12.5 },
          },
        ],
      },
      { locale: "fr" },
    ];
    for (const override of invalid)
      await expect(new Order(validOrder(override)).validate()).rejects.toThrow();
  });

  it("requires complete delivery facts but accepts a coherent delivery snapshot", async () => {
    const base = validOrder();
    const address = {
      name: "Home",
      recipientName: "Sara Kazemi",
      recipientMobile: "+351912345678",
      formattedAddress: "Rua do Porto 12, Porto",
      postalCode: "4000-001",
      location: { type: "Point", coordinates: [-8.611, 41.15] },
      deliveryNotes: null,
    };
    const delivered = validOrder({
      addressId: new Types.ObjectId(),
      addressSnapshot: address,
      pricing: {
        ...base.pricing,
        deliveryFeeCents: 300,
        totalCents: 2_100,
        delivery: { distanceMeters: 1_500, baseFeeCents: 300, freeDeliveryApplied: false },
      },
      fulfillment: { ...base.fulfillment, method: "delivery" },
    });
    await expect(new Order(delivered).validate()).resolves.toBeUndefined();
    const freeThreshold = validOrder({
      addressId: new Types.ObjectId(),
      addressSnapshot: address,
      items: [
        {
          ...base.items[0]!,
          quantity: 1,
          baseUnitPriceCents: 20_000,
          effectiveUnitPriceCents: 20_000,
          unitDiscountCents: 0,
          lineBaseSubtotalCents: 20_000,
          lineDiscountCents: 0,
          lineSubtotalCents: 20_000,
          discount: { type: "none", amountCents: null, basisPoints: null },
        },
      ],
      pricing: {
        ...base.pricing,
        subtotalCents: 20_000,
        discountCents: 0,
        deliveryFeeCents: 300,
        totalCents: 20_300,
        delivery: { distanceMeters: 1_500, baseFeeCents: 300, freeDeliveryApplied: false },
      },
      fulfillment: { ...base.fulfillment, method: "delivery" },
    });
    await expect(new Order(freeThreshold).validate()).rejects.toThrow();
    await expect(
      new Order(
        validOrder({ fulfillment: { ...base.fulfillment, method: "delivery" } }),
      ).validate(),
    ).rejects.toThrow();
  });

  it("prevents edits to saved snapshots and existing history even with validation bypassed", async () => {
    const persisted = Order.hydrate(new Order(validOrder()).toObject());
    persisted.items[0]!.name = "Changed title";
    await expect(persisted.validate()).rejects.toThrow(ORDER_SNAPSHOT_IMMUTABLE_ERROR);
    await expect(persisted.save({ validateBeforeSave: false })).rejects.toThrow(
      ORDER_SNAPSHOT_IMMUTABLE_ERROR,
    );

    const history = Order.hydrate(new Order(validOrder()).toObject());
    history.statusHistory[0]!.status = "completed";
    await expect(history.validate()).rejects.toThrow(ORDER_HISTORY_APPEND_ONLY_ERROR);
    await expect(Order.updateOne({}, { $set: { "items.0.name": "Tamper" } })).rejects.toThrow(
      ORDER_SNAPSHOT_IMMUTABLE_ERROR,
    );
  });
});
