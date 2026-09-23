import { describe, expect, it } from "vitest";

import {
  SoldCountPolicyError,
  deriveSoldCountProjection,
} from "@/server/modules/dishes/policy/sold-count";

const ORDER_ID = "66f000000000000000000001";
const DISH_ID = "66f000000000000000000002";

describe("dish sold-count policy", () => {
  it("counts only completed and settled item quantities", () => {
    const base = {
      orderId: ORDER_ID,
      revision: 1,
      items: [{ dishId: DISH_ID, quantity: 4, refundedQuantity: 1 }],
    } as const;

    expect(
      deriveSoldCountProjection({ ...base, fulfillmentState: "open", paymentState: "paid" })
        .contributions,
    ).toEqual([]);
    expect(
      deriveSoldCountProjection({
        ...base,
        fulfillmentState: "completed",
        paymentState: "unpaid",
      }).contributions,
    ).toEqual([]);
    expect(
      deriveSoldCountProjection({
        ...base,
        fulfillmentState: "completed",
        paymentState: "partially_refunded",
      }).contributions,
    ).toEqual([{ dishId: DISH_ID, quantity: 3 }]);
    expect(
      deriveSoldCountProjection({
        ...base,
        fulfillmentState: "completed",
        paymentState: "refunded",
      }).contributions,
    ).toEqual([]);
    expect(
      deriveSoldCountProjection({ ...base, fulfillmentState: "cancelled", paymentState: "paid" })
        .contributions,
    ).toEqual([]);
  });

  it("creates a stable fingerprint independent of item order", () => {
    const otherDishId = "66f000000000000000000003";
    const first = deriveSoldCountProjection({
      orderId: ORDER_ID,
      revision: 3,
      fulfillmentState: "completed",
      paymentState: "paid",
      items: [
        { dishId: DISH_ID, quantity: 1 },
        { dishId: otherDishId, quantity: 2 },
      ],
    });
    const second = deriveSoldCountProjection({
      orderId: ORDER_ID,
      revision: 3,
      fulfillmentState: "completed",
      paymentState: "paid",
      items: [
        { dishId: otherDishId, quantity: 2 },
        { dishId: DISH_ID, quantity: 1 },
      ],
    });
    expect(second.fingerprint).toBe(first.fingerprint);
  });

  it.each([
    {
      expected: "invalid_order_id",
      input: {
        orderId: "not-an-object-id",
        revision: 1,
        items: [{ dishId: DISH_ID, quantity: 1 }],
      },
    },
    {
      expected: "invalid_dish_id",
      input: { revision: 1, items: [{ dishId: "not-an-object-id", quantity: 1 }] },
    },
    {
      expected: "invalid_revision",
      input: { revision: 0, items: [{ dishId: DISH_ID, quantity: 1 }] },
    },
    {
      expected: "invalid_quantity",
      input: { revision: 1, items: [{ dishId: DISH_ID, quantity: 0 }] },
    },
    {
      expected: "invalid_refunded_quantity",
      input: { revision: 1, items: [{ dishId: DISH_ID, quantity: 1, refundedQuantity: 2 }] },
    },
    {
      expected: "duplicate_dish",
      input: {
        revision: 1,
        items: [
          { dishId: DISH_ID, quantity: 1 },
          { dishId: DISH_ID, quantity: 2 },
        ],
      },
    },
  ] as const)("rejects malformed snapshots with $expected", ({ input, expected }) => {
    try {
      deriveSoldCountProjection({
        orderId: ORDER_ID,
        fulfillmentState: "completed",
        paymentState: "paid",
        ...input,
      });
      throw new Error("Expected malformed sold-count snapshot to be rejected.");
    } catch (error) {
      expect(error).toBeInstanceOf(SoldCountPolicyError);
      expect((error as SoldCountPolicyError).code).toBe(expected);
    }
  });
});
