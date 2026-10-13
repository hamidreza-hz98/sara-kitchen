import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  CartAvailabilityPolicyError,
  validateCartAvailability,
  type CartAvailabilityDependencies,
  type CartAvailabilityDishSource,
  type CartServicePolicy,
  type ValidateCartAvailabilityInput,
} from "@/server/modules/carts";

const DISH_A = "aaaaaaaaaaaaaaaaaaaaaaaa";
const DISH_B = "bbbbbbbbbbbbbbbbbbbbbbbb";
const DISH_C = "cccccccccccccccccccccccc";
const AT = new Date("2026-10-13T12:00:00.000Z");
const ALWAYS: CartServicePolicy = {
  mode: "always",
  timeZone: "Europe/Lisbon",
  cutoffMinutesBeforeClose: 0,
};

function source(
  id: string,
  overrides: Partial<CartAvailabilityDishSource> = {},
): CartAvailabilityDishSource {
  return {
    id,
    status: "published",
    deletedAt: null,
    availability: { mode: "available", availableFrom: null, availableUntil: null },
    leadTimeMinutes: 120,
    maxQuantityPerOrder: 10,
    stockQuantity: null,
    ...overrides,
  };
}

function dependencies(
  sources: readonly CartAvailabilityDishSource[],
): CartAvailabilityDependencies {
  return { loadDishesByIds: vi.fn(async () => sources) };
}

function input(overrides: Partial<ValidateCartAvailabilityInput> = {}) {
  return {
    at: AT,
    stage: "cart_mutation",
    lines: [{ dishId: DISH_A, quantity: 2 }],
    fulfillment: { method: "pickup" },
    servicePolicy: ALWAYS,
    ...overrides,
  } satisfies ValidateCartAvailabilityInput;
}

function weeklyPolicy(
  tuesdayPeriods: readonly { opensAt: string; closesAt: string }[],
  cutoffMinutesBeforeClose = 0,
): CartServicePolicy {
  return {
    mode: "weekly",
    timeZone: "Europe/Lisbon",
    cutoffMinutesBeforeClose,
    days: [
      { day: "monday", periods: [] },
      { day: "tuesday", periods: tuesdayPeriods },
      { day: "wednesday", periods: [] },
      { day: "thursday", periods: [] },
      { day: "friday", periods: [] },
      { day: "saturday", periods: [] },
      { day: "sunday", periods: [] },
    ],
  };
}

function issueCodes(result: Awaited<ReturnType<typeof validateCartAvailability>>) {
  return result.issues.map(({ code }) => code);
}

describe("cart availability validation", () => {
  it("returns one authoritative order lead time and readiness instant at cart mutation", async () => {
    const loadDishesByIds = vi.fn(async () => [
      source(DISH_A, { leadTimeMinutes: 120 }),
      source(DISH_B, { leadTimeMinutes: 300 }),
      source(DISH_C, { leadTimeMinutes: 180 }),
    ]);
    const result = await validateCartAvailability(
      input({
        lines: [
          { dishId: DISH_A, quantity: 2 },
          { dishId: DISH_B, quantity: 1 },
          { dishId: DISH_C, quantity: 3 },
        ],
      }),
      { loadDishesByIds },
    );

    expect(loadDishesByIds).toHaveBeenCalledWith([DISH_A, DISH_B, DISH_C]);
    expect(result).toMatchObject({
      stage: "cart_mutation",
      valid: true,
      evaluatedAt: "2026-10-13T12:00:00.000Z",
      orderLeadTimeMinutes: 300,
      earliestReadyAt: "2026-10-13T17:00:00.000Z",
      issues: [],
    });
  });

  it.each([
    ["draft", null],
    ["archived", null],
    ["published", new Date("2026-01-01T00:00:00.000Z")],
  ] as const)("rejects an inactive %s dish", async (status, deletedAt) => {
    const result = await validateCartAvailability(
      input(),
      dependencies([source(DISH_A, { status, deletedAt })]),
    );
    expect(result.valid).toBe(false);
    expect(result.issues[0]).toMatchObject({
      code: "dish_not_active",
      scope: "line",
      dishId: DISH_A,
      correction: { action: "remove_line" },
    });
  });

  it("evaluates scheduled availability with inclusive start and exclusive end", async () => {
    const availability = {
      mode: "scheduled" as const,
      availableFrom: new Date("2026-10-13T12:00:00.000Z"),
      availableUntil: new Date("2026-10-13T13:00:00.000Z"),
    };
    const atStart = await validateCartAvailability(
      input(),
      dependencies([source(DISH_A, { availability })]),
    );
    const atEnd = await validateCartAvailability(
      input({ at: availability.availableUntil }),
      dependencies([source(DISH_A, { availability })]),
    );
    expect(atStart.valid).toBe(true);
    expect(atEnd.issues[0]).toMatchObject({
      code: "dish_schedule_ended",
      correction: { action: "remove_line" },
    });
  });

  it("returns the exact schedule retry instant before a dish starts", async () => {
    const availableFrom = new Date("2026-10-14T08:00:00.000Z");
    const result = await validateCartAvailability(
      input(),
      dependencies([
        source(DISH_A, {
          availability: { mode: "scheduled", availableFrom, availableUntil: null },
        }),
      ]),
    );
    expect(result.issues[0]).toMatchObject({
      code: "dish_schedule_not_started",
      correction: { action: "retry_at", at: availableFrom.toISOString() },
    });
  });

  it("returns quantity corrections for dish limits and optional stock", async () => {
    const result = await validateCartAvailability(
      input({
        lines: [
          { dishId: DISH_A, quantity: 6 },
          { dishId: DISH_B, quantity: 5 },
          { dishId: DISH_C, quantity: 1 },
        ],
      }),
      dependencies([
        source(DISH_A, { maxQuantityPerOrder: 4 }),
        source(DISH_B, { maxQuantityPerOrder: 10, stockQuantity: 3 }),
        source(DISH_C, { stockQuantity: 0 }),
      ]),
    );
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "quantity_exceeds_limit",
          correction: { action: "set_quantity", quantity: 4 },
        }),
        expect.objectContaining({
          code: "stock_insufficient",
          correction: { action: "set_quantity", quantity: 3 },
        }),
        expect.objectContaining({
          code: "stock_unavailable",
          correction: { action: "remove_line" },
        }),
      ]),
    );
  });

  it("reports stale checkout lead time with a customer-confirmable correction", async () => {
    const result = await validateCartAvailability(
      input({
        stage: "checkout",
        lines: [{ dishId: DISH_A, quantity: 1, expectedLeadTimeMinutes: 60 }],
      }),
      dependencies([source(DISH_A, { leadTimeMinutes: 180 })]),
    );
    expect(result.issues[0]).toEqual({
      code: "lead_time_changed",
      scope: "line",
      dishId: DISH_A,
      lineIndex: 0,
      messageKey: "cart.availability.lead_time_changed",
      correction: {
        action: "accept_lead_time",
        leadTimeMinutes: 180,
        earliestReadyAt: "2026-10-13T15:00:00.000Z",
      },
    });
  });

  it("uses Lisbon local weekly service hours and enforces the closing cutoff", async () => {
    // 12:00Z is 13:00 in Lisbon on this daylight-saving date.
    const open = await validateCartAvailability(
      input({ servicePolicy: weeklyPolicy([{ opensAt: "12:00", closesAt: "14:00" }], 30) }),
      dependencies([source(DISH_A)]),
    );
    const cutoff = await validateCartAvailability(
      input({
        at: new Date("2026-10-13T12:30:00.000Z"),
        servicePolicy: weeklyPolicy([{ opensAt: "12:00", closesAt: "14:00" }], 30),
      }),
      dependencies([source(DISH_A)]),
    );
    const closed = await validateCartAvailability(
      input({ servicePolicy: weeklyPolicy([{ opensAt: "14:00", closesAt: "18:00" }]) }),
      dependencies([source(DISH_A)]),
    );
    expect(open.valid).toBe(true);
    expect(issueCodes(cutoff)).toContain("order_cutoff_passed");
    expect(cutoff.issues.at(-1)?.correction).toEqual({ action: "retry_when_service_opens" });
    expect(issueCodes(closed)).toContain("service_closed");
  });

  it("preserves approved 24-hour ordering even outside displayed business hours", async () => {
    const result = await validateCartAvailability(
      input({ at: new Date("2026-10-13T02:00:00.000Z"), servicePolicy: ALWAYS }),
      dependencies([source(DISH_A)]),
    );
    expect(result.valid).toBe(true);
  });

  it.each([
    ["unverified_address", "delivery_address_unverified", "select_delivery_address"],
    ["outside_service_area", "outside_delivery_area", "choose_pickup_or_address"],
  ] as const)("returns a recoverable %s delivery correction", async (reason, code, action) => {
    const result = await validateCartAvailability(
      input({
        fulfillment: { method: "delivery", deliveryArea: { eligible: false, reason } },
      }),
      dependencies([source(DISH_A)]),
    );
    expect(result.issues.at(-1)).toMatchObject({
      code,
      scope: "fulfillment",
      correction: { action },
    });
  });

  it("does not apply delivery-area rules to pickup", async () => {
    const result = await validateCartAvailability(
      input({ fulfillment: { method: "pickup" } }),
      dependencies([source(DISH_A)]),
    );
    expect(result.valid).toBe(true);
  });

  it("returns remove-line correction when a stale cart dish disappeared", async () => {
    const result = await validateCartAvailability(input({ stage: "checkout" }), dependencies([]));
    expect(result.issues[0]).toMatchObject({
      code: "dish_not_found",
      correction: { action: "remove_line" },
    });
  });

  it("rejects malformed request, service policy, and authoritative sources", async () => {
    await expect(
      validateCartAvailability(
        input({ lines: [{ dishId: DISH_A, quantity: 0 }] }),
        dependencies([source(DISH_A)]),
      ),
    ).rejects.toMatchObject({ code: "invalid_input" });
    await expect(
      validateCartAvailability(
        input({ servicePolicy: { ...ALWAYS, timeZone: "Mars/Olympus" } }),
        dependencies([source(DISH_A)]),
      ),
    ).rejects.toBeInstanceOf(CartAvailabilityPolicyError);
    await expect(
      validateCartAvailability(input(), dependencies([source(DISH_A, { leadTimeMinutes: -1 })])),
    ).rejects.toMatchObject({ code: "invalid_source" });
    await expect(
      validateCartAvailability(
        input(),
        dependencies([
          source(DISH_A, {
            availability: { mode: "scheduled", availableFrom: null, availableUntil: null },
          }),
        ]),
      ),
    ).rejects.toMatchObject({ code: "invalid_source" });
    await expect(
      validateCartAvailability(input(), dependencies([source(DISH_B)])),
    ).rejects.toMatchObject({ code: "invalid_source" });
  });

  it("returns frozen results so callers cannot silently repair stale carts", async () => {
    const result = await validateCartAvailability(input(), dependencies([source(DISH_A)]));
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.lines)).toBe(true);
    expect(Object.isFrozen(result.lines[0])).toBe(true);
    expect(Object.isFrozen(result.issues)).toBe(true);
  });
});
