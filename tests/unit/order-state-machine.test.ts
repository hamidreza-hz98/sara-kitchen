import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ORDER_STATUSES, type OrderStatus } from "@/server/modules/orders/model/order";
import {
  ORDER_TRANSITIONS,
  OrderTransitionError,
  initialOrderEffects,
  planOrderTransition,
  soldCountLifecycle,
  validateInitialOrderState,
} from "@/server/modules/orders/policy/order-state-machine";
import type { TransactionStatus } from "@/server/modules/transactions";

const system = { kind: "system" } as const;
const operator = {
  kind: "admin",
  adminId: "admin-1",
  role: "order_operator",
  active: true,
} as const;
const viewer = { kind: "admin", adminId: "admin-2", role: "viewer", active: true } as const;
const ownerCustomer = { kind: "customer", customerId: "customer-1" } as const;

function transition(overrides: Partial<Parameters<typeof planOrderTransition>[0]> = {}) {
  return planOrderTransition({
    from: "pending_payment",
    to: "confirmed",
    method: "delivery",
    priorPaymentStatus: "pending",
    paymentStatus: "paid",
    actor: system,
    orderCustomerId: "customer-1",
    reasonCode: null,
    ...overrides,
  });
}

function code(fn: () => unknown): string | null {
  try {
    fn();
    return null;
  } catch (error) {
    return error instanceof OrderTransitionError ? error.code : "unexpected";
  }
}

describe("order state machine", () => {
  it("defines every status and accepts only an unpaid system-created initial state", () => {
    expect(Object.keys(ORDER_TRANSITIONS).sort()).toEqual([...ORDER_STATUSES].sort());
    expect(() =>
      validateInitialOrderState({
        status: "pending_payment",
        actorKind: "system",
        paymentStatus: "pending",
      }),
    ).not.toThrow();
    expect(
      code(() =>
        validateInitialOrderState({
          status: "confirmed",
          actorKind: "system",
          paymentStatus: "paid",
        }),
      ),
    ).toBe("invalid_initial_state");
    expect(initialOrderEffects().notificationIntents).toEqual([
      "customer.order_received",
      "employer.order_submitted",
    ]);
  });

  it("couples capture, failure, expiry and full refund to system payment events", () => {
    expect(transition().notificationIntents).toContain("customer.order_confirmed");
    expect(code(() => transition({ paymentStatus: "authorized" }))).toBe("payment_mismatch");
    expect(code(() => transition({ actor: operator }))).toBe("payment_mismatch");
    expect(
      transition({ to: "payment_failed", paymentStatus: "failed" }).customerVisibleStatus,
    ).toBe("payment_failed");
    expect(transition({ to: "expired", paymentStatus: "expired" }).customerVisibleStatus).toBe(
      "expired",
    );
    expect(code(() => transition({ to: "expired", paymentStatus: "failed" }))).toBe(
      "payment_mismatch",
    );
    expect(
      transition({
        from: "completed",
        to: "refunded",
        priorPaymentStatus: "paid",
        paymentStatus: "refunded",
      }),
    ).toMatchObject({ recomputeSoldCount: true, refundFollowUpRequired: false });
    expect(
      code(() =>
        transition({ from: "completed", to: "refunded", paymentStatus: "partially-refunded" }),
      ),
    ).toBe("payment_mismatch");
  });

  it("requires order permissions, settled payment and correct fulfillment mode", () => {
    expect(transition({ from: "confirmed", to: "preparing", actor: operator })).toMatchObject({
      customerVisibleStatus: "preparing",
      recomputeSoldCount: false,
    });
    expect(code(() => transition({ from: "confirmed", to: "preparing", actor: viewer }))).toBe(
      "permission_denied",
    );
    expect(
      code(() =>
        transition({
          from: "confirmed",
          to: "preparing",
          actor: operator,
          paymentStatus: "pending",
        }),
      ),
    ).toBe("payment_mismatch");
    expect(
      transition({ from: "ready", to: "out_for_delivery", actor: operator }).notificationIntents,
    ).toContain("customer.out_for_delivery");
    expect(
      code(() =>
        transition({ from: "ready", to: "out_for_delivery", actor: operator, method: "pickup" }),
      ),
    ).toBe("fulfillment_mismatch");
    expect(
      transition({ from: "ready", to: "completed", actor: operator, method: "pickup" })
        .recomputeSoldCount,
    ).toBe(true);
    expect(code(() => transition({ from: "ready", to: "completed", actor: operator }))).toBe(
      "fulfillment_mismatch",
    );
    expect(
      transition({ from: "out_for_delivery", to: "completed", actor: operator })
        .customerVisibleStatus,
    ).toBe("completed");
  });

  it("permits owner cancellation only after pending provider cancellation and flags paid refund follow-up", () => {
    expect(
      transition({
        to: "cancelled",
        actor: ownerCustomer,
        paymentStatus: "cancelled",
        reasonCode: "customer_cancelled",
      }),
    ).toMatchObject({
      refundFollowUpRequired: false,
    });
    expect(
      code(() =>
        transition({
          to: "cancelled",
          actor: { kind: "customer", customerId: "other" },
          paymentStatus: "cancelled",
          reasonCode: "customer_cancelled",
        }),
      ),
    ).toBe("ownership_mismatch");
    expect(
      code(() =>
        transition({
          to: "cancelled",
          actor: ownerCustomer,
          paymentStatus: "pending",
          reasonCode: "customer_cancelled",
        }),
      ),
    ).toBe("payment_mismatch");
    expect(
      transition({
        from: "preparing",
        to: "cancelled",
        actor: operator,
        reasonCode: "kitchen_cancelled",
      }),
    ).toMatchObject({ refundFollowUpRequired: true });
    expect(code(() => transition({ from: "preparing", to: "cancelled", actor: operator }))).toBe(
      "reason_required",
    );
  });

  it("rejects regression, duplicate state and unauthorized same-status payment sync", () => {
    for (const from of ["payment_failed", "expired", "refunded"] as const) {
      expect(code(() => transition({ from, to: "confirmed" }))).toBe("invalid_transition");
    }
    expect(code(() => transition({ from: "confirmed", to: "confirmed" }))).toBe(
      "invalid_transition",
    );
    expect(
      transition({
        from: "completed",
        to: "completed",
        priorPaymentStatus: "paid",
        paymentStatus: "partially-refunded",
        reasonCode: "payment_partial_refund",
      }),
    ).toMatchObject({
      recomputeSoldCount: true,
      notificationIntents: [],
    });
    expect(
      code(() =>
        transition({
          from: "completed",
          to: "completed",
          actor: operator,
          priorPaymentStatus: "paid",
          paymentStatus: "partially-refunded",
          reasonCode: "payment_partial_refund",
        }),
      ),
    ).toBe("invalid_transition");
  });

  it("maps every lifecycle/payment combination to the sold-count projection contract", () => {
    const cases: [OrderStatus, TransactionStatus, string, string][] = [
      ["pending_payment", "pending", "open", "unpaid"],
      ["confirmed", "paid", "open", "paid"],
      ["completed", "paid", "completed", "paid"],
      ["completed", "partially-refunded", "completed", "partially_refunded"],
      ["cancelled", "paid", "cancelled", "paid"],
      ["refunded", "refunded", "cancelled", "refunded"],
    ];
    for (const [status, paymentStatus, fulfillmentState, paymentState] of cases) {
      expect(soldCountLifecycle({ status, paymentStatus })).toEqual({
        fulfillmentState,
        paymentState,
      });
    }
  });
});
