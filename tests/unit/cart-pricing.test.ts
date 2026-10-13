import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { DishDiscount } from "@/server/modules/dishes";
import {
  CART_FREE_DELIVERY_THRESHOLD_CENTS,
  CART_TAX_POLICY,
  CartPricingError,
  calculateCartPricing,
  type CalculateCartPricingInput,
  type CartPricingDependencies,
  type CartPricingDishSource,
} from "@/server/modules/carts";

const DISH_A = "aaaaaaaaaaaaaaaaaaaaaaaa";
const DISH_B = "bbbbbbbbbbbbbbbbbbbbbbbb";
const DISH_C = "cccccccccccccccccccccccc";
const AT = new Date("2026-10-13T12:00:00.000Z");
const BANDS = Object.freeze([
  Object.freeze({ maxDistanceMeters: 2_000, feeCents: 300 }),
  Object.freeze({ maxDistanceMeters: 5_000, feeCents: 600 }),
]);

const NONE: DishDiscount = {
  type: "none",
  amountCents: null,
  basisPoints: null,
  startsAt: null,
  endsAt: null,
};

const fixed = (amountCents: number, overrides: Partial<DishDiscount> = {}): DishDiscount => ({
  type: "fixed",
  amountCents,
  basisPoints: null,
  startsAt: null,
  endsAt: null,
  ...overrides,
});

const percentage = (basisPoints: number): DishDiscount => ({
  type: "percentage",
  amountCents: null,
  basisPoints,
  startsAt: null,
  endsAt: null,
});

function dependencies(sources: readonly CartPricingDishSource[]): CartPricingDependencies {
  return {
    loadDishesByIds: vi.fn(async () => sources),
  };
}

function input(overrides: Partial<CalculateCartPricingInput> = {}): CalculateCartPricingInput {
  return {
    at: AT,
    deliveryBands: BANDS,
    fulfillment: { method: "delivery", distanceMeters: 2_000 },
    lines: [{ dishId: DISH_A, quantity: 1 }],
    ...overrides,
  };
}

async function expectPricingError(
  promise: Promise<unknown>,
  code: InstanceType<typeof CartPricingError>["issues"][number]["code"],
): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(CartPricingError);
  try {
    await promise;
  } catch (error) {
    expect((error as CartPricingError).issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code })]),
    );
  }
}

describe("cart pricing engine", () => {
  it("matches the approved integer-cent pricing golden fixture", async () => {
    const result = await calculateCartPricing(
      input({
        lines: [
          { dishId: DISH_A, quantity: 2 },
          { dishId: DISH_B, quantity: 3 },
        ],
        adjustments: [
          { code: "packaging", amountCents: 100 },
          { code: "service-credit", amountCents: -50 },
        ],
      }),
      dependencies([
        { id: DISH_A, basePriceCents: 1_000, discount: fixed(100) },
        { id: DISH_B, basePriceCents: 999, discount: percentage(1_500) },
      ]),
    );

    expect(result).toEqual({
      currency: "EUR",
      pricedAt: "2026-10-13T12:00:00.000Z",
      lines: [
        {
          dishId: DISH_A,
          quantity: 2,
          baseUnitPriceCents: 1_000,
          unitDiscountCents: 100,
          effectiveUnitPriceCents: 900,
          lineBaseSubtotalCents: 2_000,
          lineDiscountCents: 200,
          lineSubtotalCents: 1_800,
        },
        {
          dishId: DISH_B,
          quantity: 3,
          baseUnitPriceCents: 999,
          unitDiscountCents: 150,
          effectiveUnitPriceCents: 849,
          lineBaseSubtotalCents: 2_997,
          lineDiscountCents: 450,
          lineSubtotalCents: 2_547,
        },
      ],
      delivery: {
        method: "delivery",
        distanceMeters: 2_000,
        appliedBand: { maxDistanceMeters: 2_000, feeCents: 300 },
        feeCents: 300,
        freeDeliveryApplied: false,
      },
      adjustments: [
        { code: "packaging", amountCents: 100 },
        { code: "service-credit", amountCents: -50 },
      ],
      tax: { policy: CART_TAX_POLICY, amountCents: 0 },
      summary: {
        subtotalCents: 4_997,
        discountCents: 650,
        deliveryFeeCents: 300,
        taxCents: 0,
        adjustmentsCents: 50,
        totalCents: 4_697,
        calculatedAt: "2026-10-13T12:00:00.000Z",
      },
    });
  });

  it("ignores browser-supplied prices and requests only dish identity from the authoritative port", async () => {
    const loadDishesByIds = vi.fn(async () => [
      { id: DISH_A, basePriceCents: 1_250, discount: fixed(250) },
    ]);
    const spoofedLine = {
      dishId: DISH_A,
      quantity: 2,
      basePriceCents: 1,
      discountCents: 1_000_000,
      effectivePriceCents: 0,
      totalCents: 0,
    };

    const result = await calculateCartPricing(input({ lines: [spoofedLine] }), { loadDishesByIds });

    expect(loadDishesByIds).toHaveBeenCalledWith([DISH_A]);
    expect(result.lines[0]).toMatchObject({
      baseUnitPriceCents: 1_250,
      unitDiscountCents: 250,
      lineSubtotalCents: 2_000,
    });
    expect(result.summary.totalCents).toBe(2_300);
  });

  it.each([
    [CART_FREE_DELIVERY_THRESHOLD_CENTS - 1, 600, false],
    [CART_FREE_DELIVERY_THRESHOLD_CENTS, 0, true],
  ] as const)(
    "applies the free-delivery threshold to discounted merchandise subtotal %i",
    async (priceCents, feeCents, freeDeliveryApplied) => {
      const result = await calculateCartPricing(
        input({ fulfillment: { method: "delivery", distanceMeters: 2_001 } }),
        dependencies([{ id: DISH_A, basePriceCents: priceCents, discount: NONE }]),
      );
      expect(result.delivery).toMatchObject({ feeCents, freeDeliveryApplied });
      expect(result.summary.totalCents).toBe(priceCents + feeCents);
    },
  );

  it("keeps pickup free and tax disabled regardless of configured delivery fees", async () => {
    const result = await calculateCartPricing(
      input({ fulfillment: { method: "pickup" } }),
      dependencies([{ id: DISH_A, basePriceCents: 2_000, discount: NONE }]),
    );
    expect(result.delivery).toEqual({
      method: "pickup",
      distanceMeters: null,
      appliedBand: null,
      feeCents: 0,
      freeDeliveryApplied: false,
    });
    expect(result.tax).toEqual({ policy: "disabled_mvp", amountCents: 0 });
    expect(result.summary).toMatchObject({ deliveryFeeCents: 0, taxCents: 0, totalCents: 2_000 });
  });

  it.each([
    [2_000, 300],
    [2_001, 600],
    [5_000, 600],
  ])("uses inclusive deterministic delivery band boundary %i", async (distanceMeters, feeCents) => {
    const result = await calculateCartPricing(
      input({ fulfillment: { method: "delivery", distanceMeters } }),
      dependencies([{ id: DISH_A, basePriceCents: 1_000, discount: NONE }]),
    );
    expect(result.delivery.feeCents).toBe(feeCents);
  });

  it("honors inclusive discount start and exclusive end through authoritative dish pricing", async () => {
    const scheduled = fixed(250, {
      startsAt: new Date("2026-10-13T12:00:00.000Z"),
      endsAt: new Date("2026-10-14T12:00:00.000Z"),
    });
    const deps = dependencies([{ id: DISH_A, basePriceCents: 1_000, discount: scheduled }]);
    const atStart = await calculateCartPricing(input(), deps);
    const atEnd = await calculateCartPricing(input({ at: scheduled.endsAt! }), deps);
    expect(atStart.lines[0]?.effectiveUnitPriceCents).toBe(750);
    expect(atEnd.lines[0]?.effectiveUnitPriceCents).toBe(1_000);
  });

  it.each([
    [
      input({ fulfillment: { method: "delivery", distanceMeters: 5_001 } }),
      "delivery_distance_unsupported",
    ],
    [input({ lines: [{ dishId: DISH_A, quantity: 0 }] }), "invalid_line"],
    [
      input({
        lines: [
          { dishId: DISH_A, quantity: 1 },
          { dishId: DISH_A, quantity: 2 },
        ],
      }),
      "duplicate_dish",
    ],
    [input({ adjustments: [{ code: "credit", amountCents: -2_000 }] }), "negative_total"],
  ] as const)("rejects unsafe cart pricing input %#", async (pricingInput, code) => {
    await expectPricingError(
      calculateCartPricing(
        pricingInput,
        dependencies([{ id: DISH_A, basePriceCents: 1_000, discount: NONE }]),
      ),
      code,
    );
  });

  it("rejects missing, extraneous, duplicate, or invalid authoritative dish sources", async () => {
    await expectPricingError(calculateCartPricing(input(), dependencies([])), "dish_not_found");
    await expectPricingError(
      calculateCartPricing(
        input(),
        dependencies([{ id: DISH_C, basePriceCents: 1_000, discount: NONE }]),
      ),
      "invalid_dish_source",
    );
    await expectPricingError(
      calculateCartPricing(
        input(),
        dependencies([
          { id: DISH_A, basePriceCents: 1_000, discount: NONE },
          { id: DISH_A, basePriceCents: 1_000, discount: NONE },
        ]),
      ),
      "invalid_dish_source",
    );
    await expectPricingError(
      calculateCartPricing(
        input(),
        dependencies([{ id: DISH_A, basePriceCents: -1, discount: NONE }]),
      ),
      "invalid_dish_source",
    );
  });

  it("returns immutable pricing snapshots", async () => {
    const result = await calculateCartPricing(
      input(),
      dependencies([{ id: DISH_A, basePriceCents: 1_000, discount: NONE }]),
    );
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.lines)).toBe(true);
    expect(Object.isFrozen(result.lines[0])).toBe(true);
    expect(Object.isFrozen(result.summary)).toBe(true);
    expect(Object.isFrozen(result.delivery)).toBe(true);
  });
});
