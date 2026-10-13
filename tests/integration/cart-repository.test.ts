import { Mongoose, Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  CartRepositoryConflictError,
  createCartRepository,
  type CartWrite,
} from "@/server/modules/carts";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

describe("cart repository optimistic writes", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-cart-repository-test");
    client = new Mongoose();
    await client.connect(database.uri);
  }, 120_000);

  afterAll(async () => {
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  it("allows exactly one simultaneous write for one observed cart version", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const repository = createCartRepository(client.connection);
    const customerId = new Types.ObjectId().toHexString();
    const dishA = new Types.ObjectId().toHexString();
    const dishB = new Types.ObjectId().toHexString();
    const expiresAt = new Date("2027-04-11T12:00:00.000Z");
    const calculatedAt = new Date("2026-10-13T12:00:00.000Z");
    const cart = await repository.create(
      { kind: "customer", customerId },
      { expiresAt, absoluteExpiresAt: null },
    );
    const write = (dishId: string, totalCents: number): CartWrite => ({
      lines: [{ dishId, quantity: 1 }],
      selectedAddressId: null,
      notes: null,
      expiresAt,
      pricing: {
        subtotalCents: totalCents,
        discountCents: 0,
        deliveryFeeCents: 0,
        taxCents: 0,
        adjustmentsCents: 0,
        totalCents,
        calculatedAt,
      },
    });

    const results = await Promise.allSettled([
      repository.save(cart, cart.version, write(dishA, 1_000)),
      repository.save(cart, cart.version, write(dishB, 2_000)),
    ]);
    const fulfilled = results.filter(
      (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof repository.save>>> =>
        result.status === "fulfilled",
    );
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    expect(fulfilled).toHaveLength(1);
    expect(fulfilled[0]?.value.version).toBe(2);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toBeInstanceOf(CartRepositoryConflictError);

    const stored = await repository.findActive({ kind: "customer", customerId });
    expect(stored).toMatchObject({
      version: 2,
      lines: fulfilled[0]?.value.lines,
      pricing: { totalCents: fulfilled[0]?.value.pricing.totalCents },
    });
  });
});
