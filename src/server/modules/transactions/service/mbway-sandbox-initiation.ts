import "server-only";

import { createHash } from "node:crypto";

import { isValidObjectId } from "mongoose";
import type { Connection } from "mongoose";

import {
  getTransactionModel,
  TRANSACTION_MAX_AMOUNT_CENTS,
  type TransactionStatus,
} from "../model/transaction";
import { planTransactionTransition } from "../policy/transaction-state-machine";
import { PaymentProviderError, type ProviderPaymentStatus } from "../provider/payment-provider";

const SAFE_REFERENCE = /^(?!.*\d{12,})[A-Za-z0-9._:-]{1,128}$/u;
const SAFE_KEY = /^[A-Za-z0-9._:-]{8,128}$/u;

export type StoredMbWayInitiation = {
  transactionId: string;
  providerPaymentId: string;
  providerRequestId: string;
  status: TransactionStatus;
};

/** Persist a known provider initiation outcome. Never invoke the provider inside this write. */
export async function persistMbWaySandboxInitiation(
  connection: Connection,
  input: {
    transactionId: string;
    idempotencyKey: string;
    response: ProviderPaymentStatus;
  },
): Promise<StoredMbWayInitiation> {
  const { transactionId, idempotencyKey, response } = input;
  if (
    !isValidObjectId(transactionId) ||
    !SAFE_KEY.test(idempotencyKey) ||
    !SAFE_REFERENCE.test(response.providerPaymentId) ||
    !SAFE_REFERENCE.test(response.providerRequestId) ||
    response.currency !== "EUR" ||
    response.status !== "pending" ||
    !Number.isSafeInteger(response.amounts.requestedCents) ||
    response.amounts.requestedCents < 1 ||
    response.amounts.requestedCents > TRANSACTION_MAX_AMOUNT_CENTS ||
    response.amounts.authorizedCents !== 0 ||
    response.amounts.capturedCents !== 0 ||
    response.amounts.refundedCents !== 0 ||
    !(response.observedAt instanceof Date) ||
    !Number.isFinite(response.observedAt.getTime())
  ) {
    throw new PaymentProviderError("invalid-request", "Invalid MB Way sandbox initiation outcome.");
  }

  const Transaction = getTransactionModel(connection);
  const record = await Transaction.findById(transactionId).select(
    "+providerReferences +idempotencyKeyHash",
  );
  if (!record) throw new PaymentProviderError("not-found", "Transaction was not found.");
  if (record.method !== "mbway" || record.provider !== "mbway-sandbox") {
    throw new PaymentProviderError("conflict", "Transaction is not an MB Way sandbox attempt.");
  }
  if (record.idempotencyKeyHash !== createHash("sha256").update(idempotencyKey).digest("hex")) {
    throw new PaymentProviderError(
      "conflict",
      "Payment idempotency key does not match the transaction.",
    );
  }
  if (record.amounts.requestedCents !== response.amounts.requestedCents) {
    throw new PaymentProviderError("conflict", "Provider amount does not match the transaction.");
  }

  const result: StoredMbWayInitiation = {
    transactionId,
    providerPaymentId: response.providerPaymentId,
    providerRequestId: response.providerRequestId,
    status: record.status,
  };
  if (record.providerReferences.paymentId || record.providerReferences.requestId) {
    if (
      record.providerReferences.paymentId === response.providerPaymentId &&
      record.providerReferences.requestId === response.providerRequestId
    )
      return result;
    throw new PaymentProviderError(
      "conflict",
      "Transaction already references a different payment.",
    );
  }
  if (
    record.status !== "created" ||
    record.providerReferences.paymentId ||
    record.providerReferences.requestId
  ) {
    throw new PaymentProviderError(
      "conflict",
      "Transaction cannot accept a new provider initiation.",
    );
  }

  const transition = planTransactionTransition(
    {
      requestedCents: record.amounts.requestedCents,
      amounts: {
        requestedCents: record.amounts.requestedCents,
        authorizedCents: record.amounts.authorizedCents,
        capturedCents: record.amounts.capturedCents,
        refundedCents: record.amounts.refundedCents,
      },
      status: record.status,
      events: record.events,
    },
    {
      kind: "payment.pending",
      eventKey: `mbway:init:${createHash("sha256").update(response.providerPaymentId).digest("hex").slice(0, 32)}`,
      amountCents: null,
      occurredAt: response.observedAt,
      recordedAt: new Date(),
      source: "system",
    },
  );
  record.status = transition.status;
  record.amounts = transition.amounts;
  record.events.push(transition.event);
  record.providerReferences = {
    paymentId: response.providerPaymentId,
    requestId: response.providerRequestId,
  };
  await record.save();
  return { ...result, status: "pending" };
}
