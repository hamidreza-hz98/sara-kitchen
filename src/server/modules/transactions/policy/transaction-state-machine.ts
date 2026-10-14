import type { TransactionAmounts, TransactionEvent, TransactionStatus } from "../model/transaction";

export const TRANSACTION_TRANSITIONS = Object.freeze({
  created: Object.freeze(["pending", "authorized", "paid", "failed", "cancelled", "expired"]),
  pending: Object.freeze(["authorized", "paid", "failed", "cancelled", "expired"]),
  authorized: Object.freeze(["paid", "failed", "cancelled", "expired"]),
  paid: Object.freeze(["partially-refunded", "refunded"]),
  "partially-refunded": Object.freeze(["partially-refunded", "refunded"]),
  refunded: Object.freeze([]),
  failed: Object.freeze([]),
  cancelled: Object.freeze([]),
  expired: Object.freeze([]),
} as const satisfies Record<TransactionStatus, readonly TransactionStatus[]>);

export const MBWAY_SANDBOX_EVENT_MAP = Object.freeze({
  PENDING: "payment.pending",
  AUTHORIZED: "payment.authorized",
  PAID: "payment.captured",
  FAILED: "payment.failed",
  CANCELLED: "payment.cancelled",
  EXPIRED: "payment.expired",
  REFUNDED: "payment.refunded",
} as const);

export type TransactionEventKind =
  (typeof MBWAY_SANDBOX_EVENT_MAP)[keyof typeof MBWAY_SANDBOX_EVENT_MAP];

export type TransactionTransitionInput = {
  kind: TransactionEventKind;
  eventKey: string;
  providerEventId?: string | null;
  amountCents?: number | null;
  responseCode?: string | null;
  occurredAt: Date;
  recordedAt?: Date;
  source: "provider" | "admin" | "system";
};

export type TransactionSnapshot = {
  requestedCents: number;
  amounts: TransactionAmounts;
  status: TransactionStatus;
  events: readonly TransactionEvent[];
};

export type TransactionTransition = {
  amounts: TransactionAmounts;
  event: TransactionEvent;
  status: TransactionStatus;
};

export class TransactionTransitionError extends Error {
  constructor(
    readonly code:
      | "duplicate-event"
      | "invalid-transition"
      | "invalid-amount"
      | "invalid-history"
      | "unknown-provider-event",
    message: string,
  ) {
    super(message);
    this.name = "TransactionTransitionError";
  }
}

const reject = (code: TransactionTransitionError["code"], message: string): never => {
  throw new TransactionTransitionError(code, message);
};

const isCents = (value: number) => Number.isSafeInteger(value) && value >= 0;

function nextAmounts(
  previous: TransactionAmounts,
  requestedCents: number,
  status: TransactionStatus,
  amountCents: number | null,
): TransactionAmounts {
  const amounts = { ...previous };
  if (status === "authorized" || status === "paid") {
    if (amountCents !== requestedCents) {
      return reject("invalid-amount", "Authorization and capture must equal the requested cents.");
    }
    if (status === "authorized") amounts.authorizedCents = amountCents;
    else amounts.capturedCents = amountCents;
  } else if (status === "partially-refunded" || status === "refunded") {
    if (amountCents === null || !isCents(amountCents) || amountCents === 0) {
      return reject("invalid-amount", "Refund event requires a positive integer-cent amount.");
    }
    const totalRefunded = amounts.refundedCents + amountCents;
    if (totalRefunded > amounts.capturedCents) {
      reject("invalid-amount", "Refunds cannot exceed captured cents.");
    }
    if (
      (status === "refunded" && totalRefunded !== amounts.capturedCents) ||
      (status === "partially-refunded" && totalRefunded >= amounts.capturedCents)
    ) {
      reject("invalid-amount", "Refund status must match the cumulative refunded amount.");
    }
    amounts.refundedCents = totalRefunded;
  } else if (amountCents !== null) {
    reject("invalid-amount", "Non-financial events cannot carry an amount.");
  }
  return amounts;
}

function applyEvent(
  previousStatus: TransactionStatus,
  previousAmounts: TransactionAmounts,
  requestedCents: number,
  event: TransactionEvent,
): TransactionAmounts {
  const allowed: readonly TransactionStatus[] = TRANSACTION_TRANSITIONS[previousStatus];
  if (!allowed.includes(event.status)) {
    reject("invalid-transition", `Cannot transition from ${previousStatus} to ${event.status}.`);
  }
  return nextAmounts(previousAmounts, requestedCents, event.status, event.amountCents);
}

export function replayTransactionHistory(
  requestedCents: number,
  events: readonly TransactionEvent[],
): { amounts: TransactionAmounts; status: TransactionStatus } {
  if (!isCents(requestedCents) || events.length === 0) {
    return reject("invalid-history", "Transaction needs a requested amount and initial event.");
  }
  const initial = events[0]!;
  if (initial.status !== "created" || initial.source !== "system" || initial.amountCents !== null) {
    return reject(
      "invalid-history",
      "History must start with an amount-free system created event.",
    );
  }
  let status: TransactionStatus = "created";
  let amounts: TransactionAmounts = {
    requestedCents,
    authorizedCents: 0,
    capturedCents: 0,
    refundedCents: 0,
  };
  const keys = new Set<string>();
  const providerIds = new Set<string>();
  for (const [index, event] of events.entries()) {
    if (
      keys.has(event.eventKey) ||
      (event.providerEventId && providerIds.has(event.providerEventId))
    ) {
      return reject("duplicate-event", "Transaction event identity has already been recorded.");
    }
    keys.add(event.eventKey);
    if (event.providerEventId) providerIds.add(event.providerEventId);
    if (index === 0) continue;
    amounts = applyEvent(status, amounts, requestedCents, event);
    status = event.status;
  }
  return { amounts, status };
}

const eventStatus: Readonly<Record<TransactionEventKind, TransactionStatus | "refund">> =
  Object.freeze({
    "payment.pending": "pending",
    "payment.authorized": "authorized",
    "payment.captured": "paid",
    "payment.failed": "failed",
    "payment.cancelled": "cancelled",
    "payment.expired": "expired",
    "payment.refunded": "refund",
  });

export function planTransactionTransition(
  snapshot: TransactionSnapshot,
  input: TransactionTransitionInput,
): TransactionTransition {
  const current = replayTransactionHistory(snapshot.requestedCents, snapshot.events);
  if (
    current.status !== snapshot.status ||
    Object.keys(current.amounts).some(
      (key) =>
        current.amounts[key as keyof TransactionAmounts] !==
        snapshot.amounts[key as keyof TransactionAmounts],
    )
  ) {
    return reject("invalid-history", "Stored transaction state does not match its event history.");
  }
  const mapped = eventStatus[input.kind];
  if (!mapped) return reject("unknown-provider-event", "Unknown normalized payment event.");
  if (
    snapshot.events.some(
      (event) =>
        event.eventKey === input.eventKey ||
        (input.providerEventId && event.providerEventId === input.providerEventId),
    )
  ) {
    return reject("duplicate-event", "Transaction event identity has already been recorded.");
  }
  const amountCents = input.amountCents ?? null;
  const refunded = snapshot.amounts.refundedCents + (amountCents ?? 0);
  const status =
    mapped === "refund"
      ? refunded === snapshot.amounts.capturedCents
        ? "refunded"
        : "partially-refunded"
      : mapped;
  const event: TransactionEvent = {
    eventKey: input.eventKey,
    source: input.source,
    status,
    amountCents,
    responseCode: input.responseCode ?? null,
    providerEventId: input.providerEventId ?? null,
    occurredAt: input.occurredAt,
    recordedAt: input.recordedAt ?? new Date(),
  };
  return {
    amounts: applyEvent(snapshot.status, snapshot.amounts, snapshot.requestedCents, event),
    event,
    status,
  };
}

/** Internal fixture vocabulary only; a real acquirer must provide its own authenticated adapter. */
export function mapMbWaySandboxEvent(code: string): TransactionEventKind {
  if (Object.prototype.hasOwnProperty.call(MBWAY_SANDBOX_EVENT_MAP, code)) {
    return MBWAY_SANDBOX_EVENT_MAP[code as keyof typeof MBWAY_SANDBOX_EVENT_MAP];
  }
  return reject("unknown-provider-event", "Unrecognized MB Way sandbox event code.");
}
