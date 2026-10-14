import "server-only";

import type { Connection } from "mongoose";

import { withMongoTransaction } from "@/server/database/transaction-boundary";

import { getTransactionModel } from "../model/transaction";
import {
  getPaymentWebhookEventModel,
  type PaymentWebhookIgnoreReason,
} from "../model/payment-webhook-event";
import {
  mapMbWaySandboxEvent,
  planTransactionTransition,
  TransactionTransitionError,
} from "../policy/transaction-state-machine";
import type { VerifiedMbWaySandboxEvent } from "../validation/mbway-sandbox-webhook";

export class PaymentWebhookConflictError extends Error {
  constructor() {
    super("Provider event ID was reused with different verified data.");
    this.name = "PaymentWebhookConflictError";
  }
}

export class PaymentWebhookUnmatchedError extends Error {
  constructor() {
    super("Verified payment event has no matching local transaction yet.");
    this.name = "PaymentWebhookUnmatchedError";
  }
}

export type PaymentWebhookOutcome = "applied" | "duplicate" | "ignored";

function sameEvent(
  existing: {
    providerPaymentId: string;
    code: string;
    amountCents: number | null;
    responseCode: string | null;
    occurredAt: Date;
  },
  incoming: VerifiedMbWaySandboxEvent,
): boolean {
  return (
    existing.providerPaymentId === incoming.paymentId &&
    existing.code === incoming.code &&
    existing.amountCents === incoming.amountCents &&
    existing.responseCode === incoming.responseCode &&
    existing.occurredAt.getTime() === incoming.occurredAt.getTime()
  );
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

function ignoredReason(error: TransactionTransitionError): PaymentWebhookIgnoreReason {
  switch (error.code) {
    case "invalid-transition":
      return "out-of-order";
    case "duplicate-event":
      return "duplicate-event";
    case "invalid-amount":
      return "invalid-amount";
    case "invalid-history":
      return "invalid-history";
    case "unknown-provider-event":
      return "invalid-history";
  }
}

/** Durable write happens before the state-machine transaction. A duplicate is safe to retry. */
export async function receiveVerifiedMbWayWebhook(
  connection: Connection,
  event: VerifiedMbWaySandboxEvent,
): Promise<{ id: string; alreadyProcessed: boolean }> {
  const WebhookEvent = getPaymentWebhookEventModel(connection);
  try {
    const created = await WebhookEvent.create({
      provider: "mbway-sandbox",
      providerEventId: event.eventId,
      providerPaymentId: event.paymentId,
      code: event.code,
      amountCents: event.amountCents,
      responseCode: event.responseCode,
      occurredAt: event.occurredAt,
      status: "received",
    });
    return { id: created._id.toHexString(), alreadyProcessed: false };
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    const existing = await WebhookEvent.findOne({
      provider: "mbway-sandbox",
      providerEventId: event.eventId,
    });
    if (!existing) throw error;
    if (!sameEvent(existing, event)) throw new PaymentWebhookConflictError();
    return { id: existing._id.toHexString(), alreadyProcessed: existing.status !== "received" };
  }
}

/** Apply one already-verified inbox event with the Transaction update in one MongoDB transaction. */
export async function processReceivedMbWayWebhook(
  connection: Connection,
  inboxId: string,
  options: { beforeComplete?: () => Promise<void> } = {},
): Promise<Exclude<PaymentWebhookOutcome, "duplicate">> {
  return withMongoTransaction(connection, async (session) => {
    const WebhookEvent = getPaymentWebhookEventModel(connection);
    const inbox = await WebhookEvent.findById(inboxId).session(session);
    if (!inbox) throw new PaymentWebhookUnmatchedError();
    if (inbox.status === "applied") return "applied";
    if (inbox.status === "ignored") return "ignored";

    const Transaction = getTransactionModel(connection);
    const transaction = await Transaction.findOne({
      provider: "mbway-sandbox",
      "providerReferences.paymentId": inbox.providerPaymentId,
    })
      .select("+providerReferences")
      .session(session);
    if (!transaction) throw new PaymentWebhookUnmatchedError();

    let result: "applied" | "ignored" = "applied";
    try {
      const transition = planTransactionTransition(
        {
          requestedCents: transaction.amounts.requestedCents,
          amounts: transaction.amounts,
          status: transaction.status,
          events: transaction.events,
        },
        {
          kind: mapMbWaySandboxEvent(inbox.code),
          eventKey: `provider:${inbox.providerEventId}`,
          providerEventId: inbox.providerEventId,
          amountCents: inbox.amountCents,
          responseCode: inbox.responseCode,
          occurredAt: inbox.occurredAt,
          source: "provider",
        },
      );
      transaction.status = transition.status;
      transaction.amounts = transition.amounts;
      transaction.events.push(transition.event);
      await transaction.save({ session });
      inbox.status = "applied";
    } catch (error) {
      if (!(error instanceof TransactionTransitionError)) throw error;
      inbox.status = "ignored";
      inbox.ignoreReason = ignoredReason(error);
      result = "ignored";
    }
    inbox.transactionId = transaction._id;
    inbox.processedAt = new Date();
    await options.beforeComplete?.();
    await inbox.save({ session });
    return result;
  });
}

export async function acceptVerifiedMbWayWebhook(
  connection: Connection,
  event: VerifiedMbWaySandboxEvent,
): Promise<PaymentWebhookOutcome> {
  const received = await receiveVerifiedMbWayWebhook(connection, event);
  if (received.alreadyProcessed) {
    const existing = await getPaymentWebhookEventModel(connection).findById(received.id);
    return existing?.status === "ignored" ? "ignored" : "duplicate";
  }
  return processReceivedMbWayWebhook(connection, received.id);
}
