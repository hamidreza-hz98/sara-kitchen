import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { DishDiscount } from "@/server/modules/dishes";
import {
  CartMergeRepositoryError,
  createCartMergeService,
  type CartAvailabilityDishSource,
  type CartMergePlan,
  type CartMergeRepository,
  type CartPricingDishSource,
  type CartSnapshot,
} from "@/server/modules/carts";

const CUSTOMER_ID = "111111111111111111111111";
const CUSTOMER_CART_ID = "222222222222222222222222";
const GUEST_CART_ID = "333333333333333333333333";
const ADDRESS_ID = "444444444444444444444444";
const DISH_A = "aaaaaaaaaaaaaaaaaaaaaaaa";
const DISH_B = "bbbbbbbbbbbbbbbbbbbbbbbb";
const DISH_C = "cccccccccccccccccccccccc";
const GUEST_HASH = "d".repeat(64);
const NOW = new Date("2026-10-13T12:00:00.000Z");
const NONE: DishDiscount = {
  type: "none",
  amountCents: null,
  basisPoints: null,
  startsAt: null,
  endsAt: null,
};

function pricing(totalCents = 0): CartSnapshot["pricing"] {
  return {
    subtotalCents: totalCents,
    discountCents: 0,
    deliveryFeeCents: 0,
    taxCents: 0,
    adjustmentsCents: 0,
    totalCents,
    calculatedAt: totalCents ? NOW.toISOString() : null,
  };
}

function cart(
  id: string,
  customerId: string | null,
  overrides: Partial<CartSnapshot> = {},
): CartSnapshot {
  return {
    id,
    customerId,
    lines: [],
    selectedAddressId: null,
    notes: null,
    pricing: pricing(),
    currency: "EUR",
    version: 1,
    expiresAt: "2027-01-01T00:00:00.000Z",
    absoluteExpiresAt: customerId ? null : "2027-02-01T00:00:00.000Z",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

function availability(
  id: string,
  overrides: Partial<CartAvailabilityDishSource> = {},
): CartAvailabilityDishSource {
  return {
    id,
    status: "published",
    deletedAt: null,
    availability: { mode: "available", availableFrom: null, availableUntil: null },
    leadTimeMinutes: 60,
    maxQuantityPerOrder: 10,
    stockQuantity: null,
    ...overrides,
  };
}

function price(id: string, basePriceCents: number): CartPricingDishSource {
  return { id, basePriceCents, discount: NONE };
}

function harness(
  options: {
    customerNotes?: string | null;
    customerDishUnavailable?: boolean;
    guestNotes?: string | null;
    idempotent?: boolean;
    repositoryError?: CartMergeRepositoryError;
  } = {},
) {
  let committedPlan: CartMergePlan | undefined;
  const customer = cart(CUSTOMER_CART_ID, CUSTOMER_ID, {
    lines: [{ dishId: DISH_A, quantity: 4 }],
    selectedAddressId: ADDRESS_ID,
    notes: options.customerNotes === undefined ? "Keep customer note" : options.customerNotes,
  });
  const guest = cart(GUEST_CART_ID, null, {
    lines: [
      { dishId: DISH_A, quantity: 4 },
      { dishId: DISH_B, quantity: 2 },
      { dishId: DISH_C, quantity: 1 },
    ],
    notes: options.guestNotes === undefined ? "Guest note" : options.guestNotes,
  });
  const sources = [
    availability(DISH_A, {
      maxQuantityPerOrder: 5,
      ...(options.customerDishUnavailable
        ? {
            availability: {
              mode: "unavailable" as const,
              availableFrom: null,
              availableUntil: null,
            },
          }
        : {}),
    }),
    availability(DISH_B, {
      availability: { mode: "unavailable", availableFrom: null, availableUntil: null },
    }),
    availability(DISH_C),
  ];
  const prices = [price(DISH_A, 1_000), price(DISH_B, 500), price(DISH_C, 2_000)];
  const repository: CartMergeRepository = {
    async merge(_input, prepare) {
      if (options.repositoryError) throw options.repositoryError;
      if (options.idempotent) {
        return { customer, guestCartId: GUEST_CART_ID, idempotent: true };
      }
      committedPlan = await prepare({ customer, guest, session: {} as never });
      return {
        guestCartId: GUEST_CART_ID,
        idempotent: false,
        customer: cart(CUSTOMER_CART_ID, CUSTOMER_ID, {
          ...customer,
          lines: committedPlan.lines,
          notes: committedPlan.notes,
          pricing: {
            ...committedPlan.pricing,
            calculatedAt: committedPlan.pricing.calculatedAt?.toISOString() ?? null,
          },
          version: 2,
        }),
      };
    },
  };
  const audit = vi.fn(async () => undefined);
  const service = createCartMergeService({
    repository,
    now: () => new Date(NOW),
    loadPolicies: async () => ({
      servicePolicy: {
        mode: "always",
        timeZone: "Europe/Lisbon",
        cutoffMinutesBeforeClose: 0,
      },
      deliveryBands: [{ maxDistanceMeters: 5_000, feeCents: 500 }],
    }),
    loadAvailabilitySources: async (ids) => sources.filter(({ id }) => ids.includes(id)),
    loadPricingSources: async (ids) => prices.filter(({ id }) => ids.includes(id)),
    resolveDelivery: async () => ({ eligible: true, distanceMeters: 2_000 }),
    audit,
  });
  return { service, audit, committedPlan: () => committedPlan };
}

describe("guest-to-customer cart merge", () => {
  it("sums duplicates, caps maximums, skips unavailable guest-only items, and preserves customer fields", async () => {
    const test = harness();
    const result = await test.service({ customerId: CUSTOMER_ID, guestTokenHash: GUEST_HASH });

    expect(result).toMatchObject({
      idempotent: false,
      guestCartId: GUEST_CART_ID,
      cart: {
        id: CUSTOMER_CART_ID,
        version: 2,
        selectedAddressId: ADDRESS_ID,
        notes: "Keep customer note",
        lines: [
          { dishId: DISH_A, quantity: 5 },
          { dishId: DISH_C, quantity: 1 },
        ],
        pricing: { subtotalCents: 7_000, deliveryFeeCents: 500, totalCents: 7_500 },
      },
      pricing: { summary: { totalCents: 7_500 } },
    });
    expect(result.notices).toEqual(
      expect.arrayContaining([
        {
          code: "quantity_capped",
          dishId: DISH_A,
          requestedQuantity: 8,
          quantity: 5,
        },
        {
          code: "unavailable_item_skipped",
          dishId: DISH_B,
          requestedQuantity: 2,
          reason: "dish_unavailable",
        },
        { code: "guest_notes_ignored" },
      ]),
    );
    expect(test.committedPlan()?.notes).toBe("Keep customer note");
    expect(test.audit).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "success", idempotent: false }),
    );
  });

  it("returns an already-merged replay without adding guest quantities again", async () => {
    const test = harness({ idempotent: true });
    const result = await test.service({ customerId: CUSTOMER_ID, guestTokenHash: GUEST_HASH });
    expect(result.idempotent).toBe(true);
    expect(result.cart.lines).toEqual([{ dishId: DISH_A, quantity: 4 }]);
    expect(result.notices).toEqual([{ code: "already_merged" }]);
  });

  it("copies guest notes only when the customer cart has no note", async () => {
    const test = harness({ customerNotes: null, guestNotes: "  Guest delivery note  " });
    await test.service({ customerId: CUSTOMER_ID, guestTokenHash: GUEST_HASH });
    expect(test.committedPlan()?.notes).toBe("Guest delivery note");
  });

  it("aborts atomically when an existing customer line is no longer available", async () => {
    const test = harness({ customerDishUnavailable: true });
    await expect(
      test.service({ customerId: CUSTOMER_ID, guestTokenHash: GUEST_HASH }),
    ).rejects.toMatchObject({
      code: "availability_changed",
      availability: {
        issues: expect.arrayContaining([expect.objectContaining({ code: "dish_unavailable" })]),
      },
    });
    expect(test.committedPlan()).toBeUndefined();
    expect(test.audit).toHaveBeenCalledWith(expect.objectContaining({ outcome: "failure" }));
  });

  it.each([
    ["conflict", "conflict"],
    ["guest_expired", "guest_expired"],
    ["guest_not_found", "not_found"],
    ["target_not_found", "not_found"],
  ] as const)("maps repository %s without partial success", async (repositoryCode, serviceCode) => {
    const test = harness({ repositoryError: new CartMergeRepositoryError(repositoryCode) });
    await expect(
      test.service({ customerId: CUSTOMER_ID, guestTokenHash: GUEST_HASH }),
    ).rejects.toMatchObject({ code: serviceCode });
    expect(test.audit).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: expect.any(String) }),
    );
  });
});
