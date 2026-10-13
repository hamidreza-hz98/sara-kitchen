import { Mongoose, Types } from "mongoose";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { CART_CURRENCY, CART_INDEX_NAMES, CART_TERMINAL_STATUSES } from "@/server/modules/carts";
import { getCartModel } from "@/server/modules/carts/model/cart";

const now = new Date("2026-10-13T12:00:00.000Z");
const idleExpiry = new Date("2026-11-12T12:00:00.000Z");
const absoluteExpiry = new Date("2027-01-11T12:00:00.000Z");

describe("cart model", () => {
  const client = new Mongoose();
  const Cart = getCartModel(client.connection);

  const guestCart = () =>
    new Cart({
      guestTokenHash: "a".repeat(64),
      expiresAt: idleExpiry,
      absoluteExpiresAt: absoluteExpiry,
    });

  it("creates a bounded EUR guest cart and never serializes its bearer digest", async () => {
    const cart = guestCart();
    await expect(cart.validate()).resolves.toBeUndefined();

    expect(cart.status).toBe("active");
    expect(cart.customerId).toBeNull();
    expect(cart.lines).toEqual([]);
    expect(cart.currency).toBe(CART_CURRENCY);
    expect(cart.version).toBe(1);
    expect(cart.pricing).toMatchObject({
      subtotalCents: 0,
      discountCents: 0,
      deliveryFeeCents: 0,
      taxCents: 0,
      adjustmentsCents: 0,
      totalCents: 0,
      calculatedAt: null,
    });
    expect(cart.purgeAt).toBeNull();
    expect(cart.toJSON()).not.toHaveProperty("guestTokenHash");
    expect(Cart.schema.path("guestTokenHash").options.select).toBe(false);
    expect(Cart.schema.options.timestamps).toBe(true);
  });

  it("requires exactly one immutable identity and keeps addresses customer-only", async () => {
    const neither = new Cart({ expiresAt: idleExpiry });
    const both = new Cart({
      customerId: new Types.ObjectId(),
      guestTokenHash: "b".repeat(64),
      expiresAt: idleExpiry,
      absoluteExpiresAt: absoluteExpiry,
    });
    const guestWithAddress = guestCart();
    guestWithAddress.selectedAddressId = new Types.ObjectId();

    await expect(neither.validate()).rejects.toMatchObject({
      errors: expect.objectContaining({ customerId: expect.anything() }),
    });
    await expect(both.validate()).rejects.toMatchObject({
      errors: expect.objectContaining({ customerId: expect.anything() }),
    });
    await expect(guestWithAddress.validate()).rejects.toMatchObject({
      errors: expect.objectContaining({ selectedAddressId: expect.anything() }),
    });
    expect(Cart.schema.path("customerId").options.immutable).toBe(true);
    expect(Cart.schema.path("guestTokenHash").options.immutable).toBe(true);
  });

  it("validates unique line quantities and authoritative pricing arithmetic", async () => {
    const dishId = new Types.ObjectId();
    const cart = new Cart({
      customerId: new Types.ObjectId(),
      expiresAt: idleExpiry,
      lines: [
        { dishId, quantity: 1 },
        { dishId, quantity: 100 },
      ],
      pricing: {
        subtotalCents: 1_000,
        discountCents: 100,
        deliveryFeeCents: 200,
        taxCents: 0,
        adjustmentsCents: 0,
        totalCents: 999,
        calculatedAt: now,
      },
    });
    const error = (await cart.validate().catch((cause: unknown) => cause)) as Error & {
      errors?: Record<string, unknown>;
    };
    expect(Object.keys(error.errors ?? {})).toEqual(
      expect.arrayContaining(["lines", "pricing.totalCents"]),
    );

    const invalidQuantity = new Cart({
      customerId: new Types.ObjectId(),
      expiresAt: idleExpiry,
      lines: [{ dishId: new Types.ObjectId(), quantity: 100 }],
      pricing: {
        subtotalCents: 1_000,
        discountCents: 0,
        deliveryFeeCents: 0,
        taxCents: 0,
        adjustmentsCents: 0,
        totalCents: 1_000,
        calculatedAt: now,
      },
    });
    await expect(invalidQuantity.validate()).rejects.toMatchObject({
      errors: expect.objectContaining({ "lines.0.quantity": expect.anything() }),
    });
  });

  it("requires terminal-only purge timestamps and coherent merge state", async () => {
    const activeWithPurge = guestCart();
    activeWithPurge.purgeAt = new Date("2027-02-10T12:00:00.000Z");
    await expect(activeWithPurge.validate()).rejects.toMatchObject({
      errors: expect.objectContaining({ purgeAt: expect.anything() }),
    });

    const expiredWithoutPurge = guestCart();
    expiredWithoutPurge.status = "expired";
    await expect(expiredWithoutPurge.validate()).rejects.toMatchObject({
      errors: expect.objectContaining({ purgeAt: expect.anything() }),
    });

    const merged = guestCart();
    merged.status = "merged";
    merged.purgeAt = new Date("2027-02-10T12:00:00.000Z");
    merged.mergedIntoCartId = new Types.ObjectId();
    await expect(merged.validate()).resolves.toBeUndefined();
  });

  it("declares partial active-identity uniqueness and terminal-only TTL cleanup", () => {
    expect(Cart.schema.indexes()).toEqual(
      expect.arrayContaining([
        [
          { customerId: 1 },
          expect.objectContaining({
            name: CART_INDEX_NAMES.activeCustomer,
            unique: true,
            partialFilterExpression: {
              status: "active",
              customerId: { $type: "objectId" },
            },
          }),
        ],
        [
          { guestTokenHash: 1 },
          expect.objectContaining({
            name: CART_INDEX_NAMES.activeGuest,
            unique: true,
            partialFilterExpression: {
              status: "active",
              guestTokenHash: { $type: "string" },
            },
          }),
        ],
        [
          { purgeAt: 1 },
          expect.objectContaining({
            name: CART_INDEX_NAMES.terminalPurge,
            expireAfterSeconds: 0,
            partialFilterExpression: { status: { $in: CART_TERMINAL_STATUSES } },
          }),
        ],
      ]),
    );
  });
});
