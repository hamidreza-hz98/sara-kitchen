import "server-only";

import { createHash } from "node:crypto";

import { Types } from "mongoose";
import type { ClientSession, Connection } from "mongoose";

import { hasAdminPermission, type AdminRole } from "@/constants/admin-access";
import { withMongoTransaction } from "@/server/database";
import { recordAuditEvent } from "@/server/modules/logs";

import {
  getTransactionModel,
  type TransactionRecord,
  type TransactionStatus,
} from "../model/transaction";
import {
  planTransactionTransition,
  type TransactionEventKind,
} from "../policy/transaction-state-machine";
import type { PaymentProvider, ProviderPaymentStatus } from "../provider/payment-provider";

export type TransactionAdmin = Readonly<{ id: string; role: AdminRole; active: true }>;
export type VerifiedPaymentState = Readonly<{
  transactionId: string;
  orderId: string;
  customerId: string;
  status: TransactionStatus;
  occurredAt: Date;
}>;
export type PaymentStateHook = (
  session: ClientSession,
  state: VerifiedPaymentState,
) => Promise<void>;

export class TransactionManagementError extends Error {
  constructor(readonly code: "forbidden" | "not_found" | "conflict" | "unsupported") {
    super(`Transaction management ${code}.`);
    this.name = "TransactionManagementError";
  }
}

function requirePermission(
  actor: TransactionAdmin,
  permission: "transactions:read" | "transactions:reconcile" | "transactions:refund",
) {
  if (!hasAdminPermission(actor, permission)) throw new TransactionManagementError("forbidden");
}

function safeView(transaction: TransactionRecord & { _id: Types.ObjectId }, sensitive: boolean) {
  return {
    id: transaction._id.toString(),
    orderId: transaction.orderId.toString(),
    customerId: transaction.customerId.toString(),
    method: transaction.method,
    provider: transaction.provider,
    currency: transaction.currency,
    status: transaction.status,
    amounts: transaction.amounts,
    responseCode: transaction.responseCode,
    providerReferences: sensitive ? transaction.providerReferences : null,
    internalNote: sensitive ? (transaction.internalNote ?? null) : null,
    managementRevision: transaction.managementRevision ?? 0,
    events: transaction.events.map((event) => ({
      status: event.status,
      source: event.source,
      amountCents: event.amountCents,
      responseCode: event.responseCode,
      occurredAt: event.occurredAt,
    })),
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt,
  };
}

function eventKind(status: TransactionStatus): TransactionEventKind {
  switch (status) {
    case "pending":
      return "payment.pending";
    case "authorized":
      return "payment.authorized";
    case "paid":
      return "payment.captured";
    case "failed":
      return "payment.failed";
    case "cancelled":
      return "payment.cancelled";
    case "expired":
      return "payment.expired";
    case "partially-refunded":
    case "refunded":
      return "payment.refunded";
    case "created":
      throw new TransactionManagementError("conflict");
  }
}

function eventAmount(
  status: TransactionStatus,
  local: TransactionRecord,
  provider: ProviderPaymentStatus,
): number | null {
  if (status === "authorized" || status === "paid") return local.amounts.requestedCents;
  if (status === "partially-refunded" || status === "refunded")
    return provider.amounts.refundedCents - local.amounts.refundedCents;
  return null;
}

function sameAmounts(
  a: TransactionRecord["amounts"],
  b: ProviderPaymentStatus["amounts"],
): boolean {
  return (
    a.requestedCents === b.requestedCents &&
    a.authorizedCents === b.authorizedCents &&
    a.capturedCents === b.capturedCents &&
    a.refundedCents === b.refundedCents
  );
}

type Context = Readonly<{ requestId: string; userAgent: string | null }>;

export function createTransactionManagement(connection: Connection, context: Context) {
  const Transaction = getTransactionModel(connection);
  const load = async (id: string, session?: ClientSession) => {
    if (!Types.ObjectId.isValid(id)) throw new TransactionManagementError("not_found");
    let query = Transaction.findById(id).select("+providerReferences");
    if (session) query = query.session(session);
    const transaction = await query;
    if (!transaction) throw new TransactionManagementError("not_found");
    return transaction;
  };
  const audit = async (
    actor: TransactionAdmin,
    transaction: TransactionRecord & { _id: Types.ObjectId },
    session: ClientSession,
    action: "crud.resource.update" | "payment.transaction.process",
    contextDetails: Record<string, string | number | boolean | null>,
  ) => {
    await recordAuditEvent(
      connection,
      {
        action,
        actor: { kind: "admin", ref: actor.id, snapshot: { displayName: null, role: actor.role } },
        resource: {
          kind: "transaction",
          ref: transaction._id.toString(),
          snapshot: { code: null, label: null, status: transaction.status },
        },
        outcome: "success",
        requestId: context.requestId,
        context: contextDetails,
        network: { policy: "omitted", ipHash: null, ipAddress: null },
        userAgent: context.userAgent,
      },
      { session },
    );
  };
  const sensitive = (actor: TransactionAdmin) =>
    hasAdminPermission(actor, "transactions:read-sensitive");
  const applyProviderStatus = async (
    actor: TransactionAdmin,
    id: string,
    providerStatus: ProviderPaymentStatus,
    onApplied: PaymentStateHook,
  ) => {
    return withMongoTransaction(connection, async (session) => {
      const transaction = await load(id, session);
      const reference = transaction.providerReferences.paymentId;
      if (
        !reference ||
        reference !== providerStatus.providerPaymentId ||
        transaction.providerReferences.requestId !== providerStatus.providerRequestId ||
        providerStatus.currency !== "EUR" ||
        providerStatus.amounts.requestedCents !== transaction.amounts.requestedCents ||
        !Number.isFinite(providerStatus.observedAt.getTime())
      )
        throw new TransactionManagementError("conflict");
      if (transaction.status === providerStatus.status) {
        if (!sameAmounts(transaction.amounts, providerStatus.amounts))
          throw new TransactionManagementError("conflict");
        await onApplied(session, {
          transactionId: transaction._id.toString(),
          orderId: transaction.orderId.toString(),
          customerId: transaction.customerId.toString(),
          status: transaction.status,
          occurredAt: providerStatus.observedAt,
        });
        return { transaction: safeView(transaction, sensitive(actor)), changed: false };
      }
      const amountCents = eventAmount(providerStatus.status, transaction, providerStatus);
      const identity = createHash("sha256")
        .update(JSON.stringify([reference, providerStatus.status, providerStatus.amounts]))
        .digest("hex")
        .slice(0, 40);
      const transition = planTransactionTransition(
        {
          requestedCents: transaction.amounts.requestedCents,
          amounts: {
            requestedCents: transaction.amounts.requestedCents,
            authorizedCents: transaction.amounts.authorizedCents,
            capturedCents: transaction.amounts.capturedCents,
            refundedCents: transaction.amounts.refundedCents,
          },
          status: transaction.status,
          events: transaction.events,
        },
        {
          kind: eventKind(providerStatus.status),
          eventKey: `reconcile:${identity}`,
          amountCents,
          occurredAt: providerStatus.observedAt,
          source: "system",
        },
      );
      if (
        transition.status !== providerStatus.status ||
        !sameAmounts(transition.amounts as TransactionRecord["amounts"], providerStatus.amounts)
      )
        throw new TransactionManagementError("conflict");
      transaction.status = transition.status;
      transaction.amounts = transition.amounts;
      transaction.events.push(transition.event);
      await transaction.save({ session });
      await onApplied(session, {
        transactionId: transaction._id.toString(),
        orderId: transaction.orderId.toString(),
        customerId: transaction.customerId.toString(),
        status: transaction.status,
        occurredAt: providerStatus.observedAt,
      });
      await audit(actor, transaction, session, "payment.transaction.process", {
        operation: "reconcile",
        status: transaction.status,
      });
      return { transaction: safeView(transaction, sensitive(actor)), changed: true };
    });
  };
  return {
    async list(
      actor: TransactionAdmin,
      input: {
        page: number;
        pageSize: number;
        status?: TransactionStatus;
        method?: TransactionRecord["method"];
        provider?: TransactionRecord["provider"];
        customerId?: string;
        orderId?: string;
        sortDirection: "asc" | "desc";
      },
    ) {
      requirePermission(actor, "transactions:read");
      const filter: Record<string, unknown> = {};
      if (input.status) filter.status = input.status;
      if (input.method) filter.method = input.method;
      if (input.provider) filter.provider = input.provider;
      if (input.customerId) filter.customerId = new Types.ObjectId(input.customerId);
      if (input.orderId) filter.orderId = new Types.ObjectId(input.orderId);
      const [records, total] = await Promise.all([
        Transaction.find(filter)
          .select("+providerReferences")
          .sort({
            createdAt: input.sortDirection === "asc" ? 1 : -1,
            _id: input.sortDirection === "asc" ? 1 : -1,
          })
          .skip((input.page - 1) * input.pageSize)
          .limit(input.pageSize),
        Transaction.countDocuments(filter),
      ]);
      return { items: records.map((record) => safeView(record, sensitive(actor))), total };
    },
    async get(actor: TransactionAdmin, id: string) {
      requirePermission(actor, "transactions:read");
      return safeView(await load(id), sensitive(actor));
    },
    async setInternalNote(
      actor: TransactionAdmin,
      id: string,
      input: { expectedManagementRevision: number; internalNote: string | null },
    ) {
      requirePermission(actor, "transactions:reconcile");
      return withMongoTransaction(connection, async (session) => {
        const transaction = await load(id, session);
        if ((transaction.managementRevision ?? 0) !== input.expectedManagementRevision)
          throw new TransactionManagementError("conflict");
        transaction.internalNote = input.internalNote;
        transaction.managementRevision = (transaction.managementRevision ?? 0) + 1;
        await transaction.save({ session });
        await audit(actor, transaction, session, "crud.resource.update", { field: "internalNote" });
        return safeView(transaction, sensitive(actor));
      });
    },
    async reconcile(
      actor: TransactionAdmin,
      id: string,
      provider: PaymentProvider,
      onApplied: PaymentStateHook,
    ) {
      requirePermission(actor, "transactions:reconcile");
      const transaction = await load(id);
      if (transaction.provider !== provider.id || !transaction.providerReferences.paymentId)
        throw new TransactionManagementError("conflict");
      const status = await provider.fetchStatus(transaction.providerReferences.paymentId);
      return applyProviderStatus(actor, id, status, onApplied);
    },
    async cancel(
      actor: TransactionAdmin,
      id: string,
      provider: PaymentProvider,
      idempotencyKey: string,
      onApplied: PaymentStateHook,
    ) {
      requirePermission(actor, "transactions:reconcile");
      if (!provider.capabilities.cancel) throw new TransactionManagementError("unsupported");
      const transaction = await load(id);
      if (
        transaction.provider !== provider.id ||
        !transaction.providerReferences.paymentId ||
        !["created", "pending", "authorized"].includes(transaction.status)
      )
        throw new TransactionManagementError("conflict");
      const status = await provider.cancel({
        providerPaymentId: transaction.providerReferences.paymentId,
        idempotencyKey,
      });
      return applyProviderStatus(actor, id, status, onApplied);
    },
    async refund(
      actor: TransactionAdmin,
      id: string,
      provider: PaymentProvider,
      input: { amountCents: number; idempotencyKey: string },
      onApplied: PaymentStateHook,
    ) {
      requirePermission(actor, "transactions:refund");
      if (!provider.capabilities.refund) throw new TransactionManagementError("unsupported");
      const transaction = await load(id);
      const remaining = transaction.amounts.capturedCents - transaction.amounts.refundedCents;
      if (
        transaction.provider !== provider.id ||
        !transaction.providerReferences.paymentId ||
        !["paid", "partially-refunded"].includes(transaction.status) ||
        input.amountCents < 1 ||
        input.amountCents > remaining
      )
        throw new TransactionManagementError("conflict");
      const status = await provider.refund({
        providerPaymentId: transaction.providerReferences.paymentId,
        amountCents: input.amountCents,
        idempotencyKey: input.idempotencyKey,
      });
      return applyProviderStatus(actor, id, status, onApplied);
    },
  };
}
