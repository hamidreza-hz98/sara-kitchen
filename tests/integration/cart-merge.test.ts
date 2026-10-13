import { Mongoose, Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { DishDiscount } from "@/server/modules/dishes";
import {
  createCartMergeRepository,
  createCartMergeService,
  createCartRepository,
} from "@/server/modules/carts";
import { getCartModel } from "@/server/modules/carts/model/cart";

import { startTestMongoReplicaSet, type TestMongoDatabase } from "../helpers/mongodb";

const NONE: DishDiscount = {
  type: "none",
  amountCents: null,
  basisPoints: null,
  startsAt: null,
  endsAt: null,
};

describe("transactional guest cart merge", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;

  beforeAll(async () => {
    database = await startTestMongoReplicaSet("sara-kitchen-cart-merge-test");
    client = new Mongoose();
    await client.connect(database.uri);
  }, 120_000);

  afterAll(async () => {
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  it("commits one merge under concurrent login retries and never doubles quantities", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const Cart = getCartModel(client.connection);
    await Cart.syncIndexes();
    const regularRepository = createCartRepository(client.connection);
    const customerId = new Types.ObjectId().toHexString();
    const dishId = new Types.ObjectId().toHexString();
    const guestTokenHash = "e".repeat(64);
    const now = new Date("2026-10-13T12:00:00.000Z");
    const expiresAt = new Date("2027-01-01T00:00:00.000Z");
    const absoluteExpiresAt = new Date("2027-02-01T00:00:00.000Z");
    const priceSummary = (quantity: number) => ({
      subtotalCents: quantity * 1_000,
      discountCents: 0,
      deliveryFeeCents: 0,
      taxCents: 0,
      adjustmentsCents: 0,
      totalCents: quantity * 1_000,
      calculatedAt: now,
    });

    const customer = await regularRepository.create(
      { kind: "customer", customerId },
      { expiresAt, absoluteExpiresAt: null },
    );
    await regularRepository.save(customer, customer.version, {
      lines: [{ dishId, quantity: 2 }],
      selectedAddressId: null,
      notes: "Customer note",
      expiresAt,
      pricing: priceSummary(2),
    });
    const guest = await regularRepository.create(
      { kind: "guest", guestTokenHash },
      { expiresAt, absoluteExpiresAt },
    );
    await regularRepository.save(guest, guest.version, {
      lines: [{ dishId, quantity: 3 }],
      selectedAddressId: null,
      notes: "Guest note",
      expiresAt,
      pricing: priceSummary(3),
    });

    const service = createCartMergeService({
      repository: createCartMergeRepository(client.connection),
      now: () => new Date(now),
      loadPolicies: async () => ({
        servicePolicy: {
          mode: "always",
          timeZone: "Europe/Lisbon",
          cutoffMinutesBeforeClose: 0,
        },
        deliveryBands: [{ maxDistanceMeters: 5_000, feeCents: 500 }],
      }),
      loadAvailabilitySources: async (ids) =>
        ids.includes(dishId)
          ? [
              {
                id: dishId,
                status: "published",
                deletedAt: null,
                availability: { mode: "available", availableFrom: null, availableUntil: null },
                leadTimeMinutes: 120,
                maxQuantityPerOrder: 10,
                stockQuantity: null,
              },
            ]
          : [],
      loadPricingSources: async (ids) =>
        ids.includes(dishId) ? [{ id: dishId, basePriceCents: 1_000, discount: NONE }] : [],
      resolveDelivery: async () => ({ eligible: true, distanceMeters: 1_000 }),
      audit: async () => undefined,
    });

    const results = await Promise.all([
      service({ customerId, guestTokenHash }),
      service({ customerId, guestTokenHash }),
    ]);
    expect(results.map(({ idempotent }) => idempotent).sort()).toEqual([false, true]);
    expect(results[0]?.cart.lines).toEqual([{ dishId, quantity: 5 }]);
    expect(results[1]?.cart.lines).toEqual([{ dishId, quantity: 5 }]);
    expect(results[0]?.pricing.summary.totalCents).toBe(5_000);
    expect(results[1]?.pricing.summary.totalCents).toBe(5_000);

    const storedCustomer = await regularRepository.findActive({ kind: "customer", customerId });
    expect(storedCustomer).toMatchObject({
      lines: [{ dishId, quantity: 5 }],
      notes: "Customer note",
      pricing: { totalCents: 5_000 },
    });
    const storedGuest = await Cart.findOne({ guestTokenHash }).select("+guestTokenHash").lean();
    expect(storedGuest).toMatchObject({
      status: "merged",
      mergedIntoCartId: new Types.ObjectId(storedCustomer!.id),
      purgeAt: expect.any(Date),
    });
  });
});
