import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { DishDiscount } from "@/server/modules/dishes/model/dish";
import {
  DISH_PRICE_CURRENCY,
  DishPricingError,
  calculateDishPrice,
  validateDishPricingDefinition,
} from "@/server/modules/dishes/pricing/dish-pricing";

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

const percentage = (basisPoints: number, overrides: Partial<DishDiscount> = {}): DishDiscount => ({
  type: "percentage",
  amountCents: null,
  basisPoints,
  startsAt: null,
  endsAt: null,
  ...overrides,
});

const at = new Date("2026-09-23T12:00:00.000Z");

describe("dish pricing", () => {
  it("returns stable no-discount metadata, including for a zero price", () => {
    expect(calculateDishPrice({ basePriceCents: 0, discount: NONE, at })).toEqual({
      currency: DISH_PRICE_CURRENCY,
      basePriceCents: 0,
      effectivePriceCents: 0,
      discountCents: 0,
      discountState: "none",
      discountMetadata: null,
      display: { badge: null, compareAtPriceCents: null, showOriginalPrice: false },
    });
  });

  it("applies one fixed discount and returns display-safe metadata", () => {
    expect(calculateDishPrice({ basePriceCents: 1_850, discount: fixed(350), at })).toEqual({
      currency: "EUR",
      basePriceCents: 1_850,
      effectivePriceCents: 1_500,
      discountCents: 350,
      discountState: "active",
      discountMetadata: {
        type: "fixed",
        state: "active",
        amountCents: 350,
        basisPoints: null,
        startsAt: null,
        endsAt: null,
      },
      display: {
        badge: { kind: "fixed", amountCents: 350 },
        compareAtPriceCents: 1_850,
        showOriginalPrice: true,
      },
    });
  });

  it.each([
    [1, 5_000, 1],
    [1, 4_999, 0],
    [101, 5_000, 51],
    [1_999, 1_500, 300],
    [1_850, 10_000, 1_850],
  ])(
    "rounds %i cents at %i basis points half-up to %i cents",
    (basePriceCents, basisPoints, expectedDiscount) => {
      const result = calculateDishPrice({
        basePriceCents,
        discount: percentage(basisPoints),
        at,
      });
      expect(result.discountCents).toBe(expectedDiscount);
      expect(result.effectivePriceCents).toBe(basePriceCents - expectedDiscount);
      expect(result.display.badge).toEqual(
        expectedDiscount > 0 ? { kind: "percentage", basisPoints } : null,
      );
    },
  );

  it("calculates the largest safe-integer percentage without multiplication overflow", () => {
    const result = calculateDishPrice({
      basePriceCents: Number.MAX_SAFE_INTEGER,
      discount: percentage(10_000),
      at,
    });
    expect(result.discountCents).toBe(Number.MAX_SAFE_INTEGER);
    expect(result.effectivePriceCents).toBe(0);
  });

  it.each([
    ["before start", "2026-09-22T23:59:59.999Z", "scheduled", 0],
    ["at inclusive start", "2026-09-23T00:00:00.000Z", "active", 250],
    ["before end", "2026-09-23T23:59:59.999Z", "active", 250],
    ["at exclusive end", "2026-09-24T00:00:00.000Z", "expired", 0],
    ["after end", "2026-09-24T00:00:00.001Z", "expired", 0],
  ] as const)("resolves %s schedule boundary", (_label, instant, state, discountCents) => {
    const result = calculateDishPrice({
      basePriceCents: 1_000,
      discount: fixed(250, {
        startsAt: new Date("2026-09-23T00:00:00.000Z"),
        endsAt: new Date("2026-09-24T00:00:00.000Z"),
      }),
      at: new Date(instant),
    });
    expect(result).toMatchObject({ discountState: state, discountCents });
    expect(result.effectivePriceCents).toBe(1_000 - discountCents);
    expect(result.display.showOriginalPrice).toBe(state === "active");
    expect(result.discountMetadata).toMatchObject({
      startsAt: "2026-09-23T00:00:00.000Z",
      endsAt: "2026-09-24T00:00:00.000Z",
      state,
    });
  });

  it("supports one-sided schedules", () => {
    expect(
      calculateDishPrice({
        basePriceCents: 1_000,
        discount: fixed(100, { startsAt: new Date("2026-09-24T00:00:00.000Z") }),
        at,
      }).discountState,
    ).toBe("scheduled");
    expect(
      calculateDishPrice({
        basePriceCents: 1_000,
        discount: fixed(100, { endsAt: new Date("2026-09-24T00:00:00.000Z") }),
        at,
      }).discountState,
    ).toBe("active");
  });

  it.each([
    [-1, NONE, "invalid_base_price"],
    [-0, NONE, "invalid_base_price"],
    [1.5, NONE, "invalid_base_price"],
    [Number.NaN, NONE, "invalid_base_price"],
    [Number.POSITIVE_INFINITY, NONE, "invalid_base_price"],
    [0, fixed(1), "discount_on_zero_price"],
    [0, percentage(1_000), "discount_on_zero_price"],
    [100, fixed(0), "invalid_fixed_discount"],
    [100, fixed(101), "fixed_discount_exceeds_price"],
    [100, fixed(10, { basisPoints: 100 }), "fixed_discount_has_percentage"],
    [100, percentage(0), "invalid_percentage_discount"],
    [100, percentage(10_001), "invalid_percentage_discount"],
    [100, percentage(12.5), "invalid_percentage_discount"],
    [100, percentage(100, { amountCents: 1 }), "percentage_discount_has_amount"],
    [100, { ...NONE, amountCents: 1 }, "none_discount_has_values"],
  ] as const)("rejects invalid definition %#", (basePriceCents, discount, code) => {
    expect(validateDishPricingDefinition(basePriceCents, discount)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code })]),
    );
    expect(() => calculateDishPrice({ basePriceCents, discount, at })).toThrow(DishPricingError);
  });

  it("reports both mutually exclusive discount values", () => {
    const issues = validateDishPricingDefinition(1_000, {
      type: "fixed",
      amountCents: 100,
      basisPoints: 500,
      startsAt: null,
      endsAt: null,
    });
    expect(issues.map(({ code }) => code)).toContain("fixed_discount_has_percentage");
  });

  it.each([
    [new Date("invalid"), null, "invalid_discount_start"],
    [null, new Date("invalid"), "invalid_discount_end"],
    [
      new Date("2026-09-24T00:00:00.000Z"),
      new Date("2026-09-23T00:00:00.000Z"),
      "invalid_discount_schedule",
    ],
    [
      new Date("2026-09-23T00:00:00.000Z"),
      new Date("2026-09-23T00:00:00.000Z"),
      "invalid_discount_schedule",
    ],
  ] as const)("rejects invalid schedule %#", (startsAt, endsAt, code) => {
    const discount = fixed(100, { startsAt, endsAt });
    expect(validateDishPricingDefinition(1_000, discount)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code })]),
    );
  });

  it("rejects an invalid evaluation instant", () => {
    expect(() =>
      calculateDishPrice({ basePriceCents: 1_000, discount: NONE, at: new Date("invalid") }),
    ).toThrow(DishPricingError);
    try {
      calculateDishPrice({ basePriceCents: 1_000, discount: NONE, at: new Date("invalid") });
    } catch (error) {
      expect(error).toBeInstanceOf(DishPricingError);
      expect((error as DishPricingError).issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: "invalid_evaluation_time" })]),
      );
    }
  });
});
