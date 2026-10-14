import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { DishDiscount } from "@/server/modules/dishes";
import {
  CART_CUSTOMER_IDLE_TTL_MS,
  CART_GUEST_ABSOLUTE_TTL_MS,
  CART_GUEST_IDLE_TTL_MS,
  CartRepositoryConflictError,
  createCartCrudServices,
  type CartAvailabilityDishSource,
  type CartCrudError,
  type CartCrudAuditEvent,
  type CartIdentity,
  type CartPricingDishSource,
  type CartRepository,
  type CartSnapshot,
  type CartWrite,
} from "@/server/modules/carts";

const CART_ID = "111111111111111111111111";
const CUSTOMER_ID = "222222222222222222222222";
const ADDRESS_ID = "333333333333333333333333";
const DISH_A = "aaaaaaaaaaaaaaaaaaaaaaaa";
const DISH_B = "bbbbbbbbbbbbbbbbbbbbbbbb";
const GUEST_HASH = "c".repeat(64);
const NOW = new Date("2026-10-13T12:00:00.000Z");
const NONE: DishDiscount = {
  type: "none",
  amountCents: null,
  basisPoints: null,
  startsAt: null,
  endsAt: null,
};
const CUSTOMER: CartIdentity = { kind: "customer", customerId: CUSTOMER_ID };
const GUEST: CartIdentity = { kind: "guest", guestTokenHash: GUEST_HASH };

function emptyPricing(): CartSnapshot["pricing"] {
  return {
    subtotalCents: 0,
    discountCents: 0,
    deliveryFeeCents: 0,
    taxCents: 0,
    adjustmentsCents: 0,
    totalCents: 0,
    calculatedAt: null,
  };
}

function createMemoryRepository() {
  let stored: CartSnapshot | null = null;
  const repository: CartRepository = {
    async findActive() {
      return stored;
    },
    async create(identity, expiry) {
      if (stored) throw new CartRepositoryConflictError();
      stored = Object.freeze({
        id: CART_ID,
        customerId: identity.kind === "customer" ? identity.customerId : null,
        lines: Object.freeze([]),
        selectedAddressId: null,
        pickupConfirmed: false,
        notes: null,
        pricing: Object.freeze(emptyPricing()),
        currency: "EUR",
        version: 1,
        expiresAt: expiry.expiresAt.toISOString(),
        absoluteExpiresAt: expiry.absoluteExpiresAt?.toISOString() ?? null,
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
      });
      return stored;
    },
    async save(current, expectedVersion, value: CartWrite) {
      if (!stored || stored.id !== current.id || stored.version !== expectedVersion) {
        throw new CartRepositoryConflictError();
      }
      stored = Object.freeze({
        ...stored,
        lines: Object.freeze(value.lines.map((line) => Object.freeze({ ...line }))),
        selectedAddressId: value.selectedAddressId,
        pickupConfirmed: value.pickupConfirmed === true,
        notes: value.notes,
        pricing: Object.freeze({
          ...value.pricing,
          calculatedAt: value.pricing.calculatedAt?.toISOString() ?? null,
        }),
        expiresAt: value.expiresAt.toISOString(),
        version: stored.version + 1,
        updatedAt: NOW.toISOString(),
      });
      return stored;
    },
    async expire(current, expectedVersion) {
      if (!stored || stored.id !== current.id || stored.version !== expectedVersion) {
        throw new CartRepositoryConflictError();
      }
      stored = null;
    },
  };
  return { repository, current: () => stored };
}

function harness() {
  const memory = createMemoryRepository();
  const audits: CartCrudAuditEvent[] = [];
  const catalog = new Map<
    string,
    Readonly<{ availability: CartAvailabilityDishSource; pricing: CartPricingDishSource }>
  >([
    [
      DISH_A,
      {
        availability: {
          id: DISH_A,
          status: "published",
          deletedAt: null,
          availability: { mode: "available", availableFrom: null, availableUntil: null },
          leadTimeMinutes: 120,
          maxQuantityPerOrder: 10,
          stockQuantity: null,
        },
        pricing: { id: DISH_A, basePriceCents: 1_000, discount: NONE },
      },
    ],
    [
      DISH_B,
      {
        availability: {
          id: DISH_B,
          status: "published",
          deletedAt: null,
          availability: { mode: "available", availableFrom: null, availableUntil: null },
          leadTimeMinutes: 300,
          maxQuantityPerOrder: 5,
          stockQuantity: null,
        },
        pricing: { id: DISH_B, basePriceCents: 2_500, discount: NONE },
      },
    ],
  ]);
  const resolveDelivery = vi.fn(
    async (): Promise<{
      eligible: boolean;
      distanceMeters?: number;
      reason?: "outside_service_area" | "unverified_address";
    }> => ({ eligible: true, distanceMeters: 2_000 }),
  );
  const services = createCartCrudServices({
    repository: memory.repository,
    now: () => new Date(NOW),
    loadPolicies: async () => ({
      servicePolicy: {
        mode: "always",
        timeZone: "Europe/Lisbon",
        cutoffMinutesBeforeClose: 0,
      },
      deliveryBands: [{ maxDistanceMeters: 5_000, feeCents: 500 }],
    }),
    availability: {
      loadDishesByIds: async (ids) =>
        ids.flatMap((id) => (catalog.get(id) ? [catalog.get(id)!.availability] : [])),
    },
    pricing: {
      loadDishesByIds: async (ids) =>
        ids.flatMap((id) => (catalog.get(id) ? [catalog.get(id)!.pricing] : [])),
    },
    resolveDelivery,
    audit: async (event) => {
      audits.push(event);
    },
  });
  return { ...memory, services, audits, catalog, resolveDelivery };
}

describe("cart CRUD services", () => {
  it("creates lazy guest/customer carts with approved expiries and authoritative empty totals", async () => {
    const guestTest = harness();
    const guest = await guestTest.services.create(GUEST);
    expect(guest.cart).toMatchObject({
      version: 1,
      customerId: null,
      pricing: { ...emptyPricing(), calculatedAt: NOW.toISOString() },
    });
    expect(new Date(guest.cart.expiresAt).getTime() - NOW.getTime()).toBe(CART_GUEST_IDLE_TTL_MS);
    expect(new Date(guest.cart.absoluteExpiresAt!).getTime() - NOW.getTime()).toBe(
      CART_GUEST_ABSOLUTE_TTL_MS,
    );
    expect(guest.pricing.summary.totalCents).toBe(0);

    const customerTest = harness();
    const customer = await customerTest.services.create(CUSTOMER);
    expect(customer.cart.absoluteExpiresAt).toBeNull();
    expect(new Date(customer.cart.expiresAt).getTime() - NOW.getTime()).toBe(
      CART_CUSTOMER_IDLE_TTL_MS,
    );
    await expect(customerTest.services.get(CUSTOMER)).resolves.toMatchObject({
      pricing: { summary: { totalCents: 0 } },
    });
  });

  it("supports item, notes, address, recalculate, remove, and clear operations with fresh totals", async () => {
    const test = harness();
    let result = await test.services.create(CUSTOMER);
    result = await test.services.addItem(CUSTOMER, result.cart.version, DISH_A, 2);
    expect(result.cart).toMatchObject({ version: 2, lines: [{ dishId: DISH_A, quantity: 2 }] });
    expect(result.pricing.summary).toMatchObject({ subtotalCents: 2_000, totalCents: 2_000 });

    result = await test.services.addItem(CUSTOMER, result.cart.version, DISH_A, 1);
    expect(result.cart.lines[0]?.quantity).toBe(3);
    result = await test.services.updateQuantity(CUSTOMER, result.cart.version, DISH_A, 4);
    expect(result.pricing.summary.totalCents).toBe(4_000);
    result = await test.services.setNotes(CUSTOMER, result.cart.version, "  Ring bell  ");
    expect(result.cart.notes).toBe("Ring bell");

    result = await test.services.selectAddress(CUSTOMER, result.cart.version, ADDRESS_ID);
    expect(test.resolveDelivery).toHaveBeenCalledWith(CUSTOMER_ID, ADDRESS_ID);
    expect(result.pricing.summary).toMatchObject({ deliveryFeeCents: 500, totalCents: 4_500 });
    expect(result.cart.pickupConfirmed).toBe(false);

    result = await test.services.selectAddress(CUSTOMER, result.cart.version, null);
    expect(result.cart.pickupConfirmed).toBe(true);
    expect(result.cart.selectedAddressId).toBeNull();
    expect(result.pricing.summary.deliveryFeeCents).toBe(0);
    result = await test.services.selectAddress(CUSTOMER, result.cart.version, ADDRESS_ID);

    const dish = test.catalog.get(DISH_A)!;
    test.catalog.set(DISH_A, {
      ...dish,
      pricing: { ...dish.pricing, basePriceCents: 1_200 },
    });
    result = await test.services.recalculate(CUSTOMER, result.cart.version);
    expect(result.pricing.summary).toMatchObject({ subtotalCents: 4_800, totalCents: 5_300 });

    result = await test.services.removeItem(CUSTOMER, result.cart.version, DISH_A);
    expect(result.cart.lines).toEqual([]);
    expect(result.pricing.summary).toMatchObject({ deliveryFeeCents: 0, totalCents: 0 });
    result = await test.services.addItem(CUSTOMER, result.cart.version, DISH_B, 1);
    result = await test.services.clear(CUSTOMER, result.cart.version);
    expect(result.cart.lines).toEqual([]);
    expect(result.pricing.summary.totalCents).toBe(0);
    expect(result.cart.version).toBe(12);
  });

  it("rejects stale versions with the fresh authoritative cart and totals", async () => {
    const test = harness();
    const created = await test.services.create(CUSTOMER);
    const first = await test.services.addItem(CUSTOMER, created.cart.version, DISH_A, 1);

    let conflict: CartCrudError | undefined;
    try {
      await test.services.addItem(CUSTOMER, created.cart.version, DISH_B, 1);
    } catch (error) {
      conflict = error as CartCrudError;
    }
    expect(conflict).toMatchObject({ code: "conflict" });
    expect(conflict?.details.current).toMatchObject({
      cart: { version: first.cart.version, lines: [{ dishId: DISH_A, quantity: 1 }] },
      pricing: { summary: { totalCents: 1_000 } },
    });
    expect(test.current()?.lines).toEqual([{ dishId: DISH_A, quantity: 1 }]);
    expect(test.audits).toContainEqual(
      expect.objectContaining({ action: "add_item", outcome: "conflict" }),
    );
  });

  it("does not persist a line that fails current availability and returns its correction", async () => {
    const test = harness();
    const created = await test.services.create(CUSTOMER);
    const dish = test.catalog.get(DISH_A)!;
    test.catalog.set(DISH_A, {
      ...dish,
      availability: {
        ...dish.availability,
        availability: { mode: "unavailable", availableFrom: null, availableUntil: null },
      },
    });
    await expect(
      test.services.addItem(CUSTOMER, created.cart.version, DISH_A, 1),
    ).rejects.toMatchObject({
      code: "availability_changed",
      details: {
        availability: {
          issues: [
            expect.objectContaining({
              code: "dish_unavailable",
              correction: { action: "remove_line" },
            }),
          ],
        },
      },
    });
    expect(test.current()?.lines).toEqual([]);
  });

  it("keeps customer addresses forbidden for guest carts and validates delivery eligibility", async () => {
    const guestTest = harness();
    const guest = await guestTest.services.create(GUEST);
    expect(() => guestTest.services.selectAddress(GUEST, guest.cart.version, ADDRESS_ID)).toThrow(
      expect.objectContaining({ code: "forbidden" }),
    );

    const customerTest = harness();
    const customer = await customerTest.services.create(CUSTOMER);
    customerTest.resolveDelivery.mockResolvedValueOnce({
      eligible: false,
      reason: "outside_service_area",
      distanceMeters: 8_000,
    });
    await expect(
      customerTest.services.selectAddress(CUSTOMER, customer.cart.version, ADDRESS_ID),
    ).rejects.toMatchObject({
      code: "availability_changed",
      details: {
        availability: {
          issues: [expect.objectContaining({ code: "outside_delivery_area" })],
        },
      },
    });
  });

  it("expires with optimistic versioning and preserves the final totals in its response", async () => {
    const test = harness();
    let result = await test.services.create(CUSTOMER);
    result = await test.services.addItem(CUSTOMER, result.cart.version, DISH_A, 2);
    const expired = await test.services.expire(CUSTOMER, result.cart.version);
    expect(expired).toEqual({
      cartId: CART_ID,
      version: result.cart.version + 1,
      pricing: result.cart.pricing,
    });
    await expect(test.services.get(CUSTOMER)).resolves.toBeNull();
  });
});
