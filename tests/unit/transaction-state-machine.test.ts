import { describe, expect, it } from "vitest";

import type { TransactionEvent } from "@/server/modules/transactions/model/transaction";
import {
  mapMbWaySandboxEvent,
  planTransactionTransition,
  replayTransactionHistory,
  TRANSACTION_TRANSITIONS,
  TransactionTransitionError,
  type TransactionSnapshot,
  type TransactionTransitionInput,
} from "@/server/modules/transactions/policy/transaction-state-machine";

const at = new Date("2026-10-14T10:00:00.000Z");
const created: TransactionEvent = {
  eventKey: "created-1",
  source: "system",
  status: "created",
  amountCents: null,
  responseCode: null,
  providerEventId: null,
  occurredAt: at,
  recordedAt: at,
};

function snapshot(requestedCents = 1_000): TransactionSnapshot {
  return {
    requestedCents,
    status: "created",
    amounts: {
      requestedCents,
      authorizedCents: 0,
      capturedCents: 0,
      refundedCents: 0,
    },
    events: [created],
  };
}

function event(
  kind: TransactionTransitionInput["kind"],
  eventKey: string,
  amountCents: number | null = null,
): TransactionTransitionInput {
  return {
    kind,
    eventKey,
    providerEventId: `provider-${eventKey}`,
    source: "provider",
    amountCents,
    occurredAt: at,
    recordedAt: at,
  };
}

function advance(
  current: TransactionSnapshot,
  input: TransactionTransitionInput,
): TransactionSnapshot {
  const result = planTransactionTransition(current, input);
  return {
    ...current,
    status: result.status,
    amounts: result.amounts,
    events: [...current.events, result.event],
  };
}

function errorCode(operation: () => unknown) {
  try {
    operation();
    return null;
  } catch (error) {
    expect(error).toBeInstanceOf(TransactionTransitionError);
    return (error as TransactionTransitionError).code;
  }
}

describe("transaction state machine", () => {
  it("maps only known MB Way sandbox fixture codes", () => {
    expect(mapMbWaySandboxEvent("PENDING")).toBe("payment.pending");
    expect(mapMbWaySandboxEvent("PAID")).toBe("payment.captured");
    expect(mapMbWaySandboxEvent("REFUNDED")).toBe("payment.refunded");
    expect(errorCode(() => mapMbWaySandboxEvent("UNKNOWN"))).toBe("unknown-provider-event");
  });

  it("exposes an explicit transition table with terminal states", () => {
    expect(TRANSACTION_TRANSITIONS.created).toContain("pending");
    expect(TRANSACTION_TRANSITIONS.paid).toEqual(["partially-refunded", "refunded"]);
    expect(TRANSACTION_TRANSITIONS.failed).toEqual([]);
    expect(TRANSACTION_TRANSITIONS.refunded).toEqual([]);
  });

  it("supports direct MB Way capture and authorized card-like capture", () => {
    const direct = advance(
      advance(snapshot(), event("payment.pending", "pending")),
      event("payment.captured", "paid", 1_000),
    );
    expect(direct.status).toBe("paid");
    expect(direct.amounts).toMatchObject({ authorizedCents: 0, capturedCents: 1_000 });

    const authorized = advance(snapshot(), event("payment.authorized", "authorized", 1_000));
    expect(advance(authorized, event("payment.captured", "captured", 1_000)).amounts).toMatchObject(
      { authorizedCents: 1_000, capturedCents: 1_000 },
    );
  });

  it("supports multiple partial refunds followed by a full refund", () => {
    const paid = advance(snapshot(), event("payment.captured", "paid", 1_000));
    const first = advance(paid, event("payment.refunded", "refund-1", 250));
    const second = advance(first, event("payment.refunded", "refund-2", 250));
    const final = advance(second, event("payment.refunded", "refund-3", 500));
    expect(first.status).toBe("partially-refunded");
    expect(second.amounts.refundedCents).toBe(500);
    expect(final.status).toBe("refunded");
    expect(final.amounts.refundedCents).toBe(1_000);
    expect(replayTransactionHistory(1_000, final.events)).toEqual({
      status: "refunded",
      amounts: final.amounts,
    });
  });

  it("rejects duplicate keys and duplicate provider event IDs", () => {
    const pending = advance(snapshot(), event("payment.pending", "pending"));
    expect(errorCode(() => advance(pending, event("payment.captured", "pending", 1_000)))).toBe(
      "duplicate-event",
    );
    expect(
      errorCode(() =>
        advance(pending, {
          ...event("payment.captured", "capture", 1_000),
          providerEventId: "provider-pending",
        }),
      ),
    ).toBe("duplicate-event");
  });

  it("rejects regressions, terminal-state changes, and duplicate same-state callbacks", () => {
    const paid = advance(snapshot(), event("payment.captured", "paid", 1_000));
    expect(errorCode(() => advance(paid, event("payment.pending", "late-pending")))).toBe(
      "invalid-transition",
    );
    expect(errorCode(() => advance(paid, event("payment.captured", "second-paid", 1_000)))).toBe(
      "invalid-transition",
    );
    const failed = advance(snapshot(), event("payment.failed", "failed"));
    expect(errorCode(() => advance(failed, event("payment.captured", "late-paid", 1_000)))).toBe(
      "invalid-transition",
    );
  });

  it("rejects under/over settlement and mismatched refund state", () => {
    expect(errorCode(() => advance(snapshot(), event("payment.captured", "underpaid", 999)))).toBe(
      "invalid-amount",
    );
    expect(
      errorCode(() => advance(snapshot(), event("payment.pending", "pending-with-amount", 1))),
    ).toBe("invalid-amount");
    const paid = advance(snapshot(), event("payment.captured", "paid", 1_000));
    expect(errorCode(() => advance(paid, event("payment.refunded", "over-refund", 1_001)))).toBe(
      "invalid-amount",
    );
    expect(errorCode(() => advance(paid, event("payment.refunded", "zero-refund", 0)))).toBe(
      "invalid-amount",
    );
  });

  it("rejects snapshots whose status or money disagrees with event replay", () => {
    expect(
      errorCode(() =>
        planTransactionTransition(
          { ...snapshot(), status: "paid" },
          event("payment.pending", "pending"),
        ),
      ),
    ).toBe("invalid-history");
    expect(
      errorCode(() =>
        planTransactionTransition(
          {
            ...snapshot(),
            amounts: { ...snapshot().amounts, capturedCents: 1_000 },
          },
          event("payment.pending", "pending"),
        ),
      ),
    ).toBe("invalid-history");
  });
});
