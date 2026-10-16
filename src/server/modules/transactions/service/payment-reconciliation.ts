import "server-only";

import { randomUUID } from "node:crypto";

import type { Connection } from "mongoose";

import { getPaymentReconciliationModel } from "../model/payment-reconciliation";
import { getTransactionModel } from "../model/transaction";
import type { PaymentProvider } from "../provider/payment-provider";
import {
  createTransactionManagement,
  type PaymentStateHook,
  TransactionManagementError,
} from "./transaction-management";

const DEFAULT_STALE_AFTER_MS = 5 * 60_000;
const LEASE_MS = 60_000;
const MAX_ATTEMPTS = 4;
const BASE_BACKOFF_MS = 60_000;

type ProviderResolver = (provider: string) => PaymentProvider | null;
type ReconciliationAlert = Readonly<{
  transactionId: string;
  provider: string;
  errorCode: string;
  attempts: number;
}>;

export type PaymentReconciliationOptions = Readonly<{
  now?: () => Date;
  limit?: number;
  staleAfterMs?: number;
  requestId?: string;
  onAlert?: (alert: ReconciliationAlert) => Promise<void> | void;
}>;

function safeErrorCode(error: unknown): string {
  if (error instanceof TransactionManagementError) return `transaction_${error.code}`;
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
    return /^[a-z0-9_-]{1,48}$/iu.test(error.code) ? error.code.toLowerCase() : "provider_error";
  }
  return "reconciliation_failed";
}

/**
 * Discovers and processes one bounded reconciliation batch. Provider reads happen outside MongoDB
 * transactions; verified changes are applied by the normal append-only transaction state machine.
 */
export async function reconcilePayments(
  connection: Connection,
  resolveProvider: ProviderResolver,
  onApplied: PaymentStateHook,
  options: PaymentReconciliationOptions = {},
) {
  const now = options.now ?? (() => new Date());
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);
  const staleAfterMs = Math.max(options.staleAfterMs ?? DEFAULT_STALE_AFTER_MS, 0);
  const Transaction = getTransactionModel(connection);
  const Queue = getPaymentReconciliationModel(connection);
  const discoveryTime = now();
  const staleBefore = new Date(discoveryTime.getTime() - staleAfterMs);

  const candidates = await Transaction.find({
    status: { $in: ["created", "pending", "authorized"] },
    updatedAt: { $lte: staleBefore },
    "providerReferences.paymentId": { $type: "string" },
  })
    .select("provider updatedAt +providerReferences")
    .sort({ updatedAt: 1, _id: 1 })
    .limit(limit)
    .lean();

  for (const candidate of candidates) {
    await Queue.updateOne(
      { transactionId: candidate._id },
      {
        $setOnInsert: {
          transactionId: candidate._id,
          provider: candidate.provider,
          state: "pending",
          attempts: 0,
          nextAttemptAt: discoveryTime,
        },
      },
      { upsert: true },
    );
  }

  let resolved = 0;
  let retried = 0;
  let alerted = 0;
  let checked = 0;
  for (let index = 0; index < limit; index++) {
    const at = now();
    const leaseToken = randomUUID();
    const job = await Queue.findOneAndUpdate(
      {
        nextAttemptAt: { $lte: at },
        $or: [{ state: "pending" }, { state: "in_flight", lockedUntil: { $lte: at } }],
      },
      {
        $set: {
          state: "in_flight",
          leaseToken,
          lockedUntil: new Date(at.getTime() + LEASE_MS),
          lastAttemptAt: at,
        },
        $inc: { attempts: 1 },
      },
      { sort: { nextAttemptAt: 1, _id: 1 }, returnDocument: "after" },
    );
    if (!job) break;
    checked++;
    const provider = resolveProvider(job.provider);
    try {
      if (!provider)
        throw Object.assign(new Error("Provider unavailable."), { code: "provider_unavailable" });
      const result = await createTransactionManagement(connection, {
        requestId: `${options.requestId ?? "payment-reconciliation"}:${job._id.toString()}`,
        userAgent: "Sara Kitchen payment reconciliation worker",
      }).reconcile({ kind: "system" }, job.transactionId.toString(), provider, onApplied);
      const remainsPending = ["created", "pending", "authorized"].includes(
        result.transaction.status,
      );
      const terminalPending = remainsPending && job.attempts >= MAX_ATTEMPTS;
      await Queue.updateOne(
        { _id: job._id, state: "in_flight", leaseToken },
        {
          $set: {
            state: terminalPending ? "alerted" : remainsPending ? "pending" : "resolved",
            resolvedAt: remainsPending ? null : now(),
            alertedAt: terminalPending ? now() : null,
            nextAttemptAt: remainsPending
              ? new Date(now().getTime() + BASE_BACKOFF_MS * 2 ** (job.attempts - 1))
              : now(),
            lockedUntil: null,
            leaseToken: null,
            lastErrorCode: remainsPending ? "provider_still_pending" : null,
          },
        },
      );
      if (terminalPending) {
        alerted++;
        await options.onAlert?.({
          transactionId: job.transactionId.toString(),
          provider: job.provider,
          errorCode: "provider_still_pending",
          attempts: job.attempts,
        });
      } else if (remainsPending) {
        retried++;
      } else {
        resolved++;
      }
    } catch (error) {
      const errorCode = safeErrorCode(error);
      const terminal =
        errorCode === "transaction_conflict" ||
        errorCode === "transaction_not_found" ||
        job.attempts >= MAX_ATTEMPTS;
      await Queue.updateOne(
        { _id: job._id, state: "in_flight", leaseToken },
        {
          $set: {
            state: terminal ? "alerted" : "pending",
            alertedAt: terminal ? now() : null,
            nextAttemptAt: new Date(now().getTime() + BASE_BACKOFF_MS * 2 ** (job.attempts - 1)),
            lockedUntil: null,
            leaseToken: null,
            lastErrorCode: errorCode,
          },
        },
      );
      if (terminal) {
        alerted++;
        await options.onAlert?.({
          transactionId: job.transactionId.toString(),
          provider: job.provider,
          errorCode,
          attempts: job.attempts,
        });
      } else {
        retried++;
      }
    }
  }

  return {
    discovered: candidates.length,
    checked,
    resolved,
    retried,
    alerted,
    openAlerts: await Queue.countDocuments({ state: "alerted" }),
  };
}
