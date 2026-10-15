import "server-only";

import { randomUUID } from "node:crypto";

import { Types } from "mongoose";
import type { ClientSession, Connection } from "mongoose";

import { hasAdminPermission, type AdminRole } from "@/constants/admin-access";
import { escapeSearchPattern, withMongoTransaction } from "@/server/database";
import { createDishSoldCountProjector } from "@/server/modules/dishes";
import { recordAuditEvent } from "@/server/modules/logs";
import { getOrderPaymentView, type TransactionStatus } from "@/server/modules/transactions";

import { getOrderModel, ORDER_STATUSES, type OrderRecord, type OrderStatus } from "../model/order";
import { planOrderTransition, soldCountLifecycle } from "../policy/order-state-machine";
import { queueOrderNotifications } from "./notification-outbox";

export type OrderAdmin = Readonly<{ id: string; role: AdminRole; active: true }>;

export class OrderManagementError extends Error {
  constructor(readonly code: "forbidden" | "not_found" | "conflict" | "invalid") {
    super(`Order management ${code}.`);
    this.name = "OrderManagementError";
  }
}

function requirePermission(
  actor: OrderAdmin,
  permission:
    | "orders:read"
    | "orders:read-sensitive"
    | "orders:update"
    | "orders:cancel"
    | "transactions:reconcile",
) {
  if (!hasAdminPermission(actor, permission)) throw new OrderManagementError("forbidden");
}

function view(order: OrderRecord & { _id: Types.ObjectId }, sensitive: boolean) {
  return {
    id: order._id.toString(),
    code: order.code,
    status: order.status,
    revision: order.revision,
    managementRevision: order.managementRevision ?? 0,
    customerId: order.customerId.toString(),
    customer: sensitive ? order.customerSnapshot : null,
    address: sensitive ? order.addressSnapshot : null,
    items: order.items.map((item) => ({
      dishId: item.dishId.toString(),
      slug: item.slug,
      name: item.name,
      quantity: item.quantity,
      baseUnitPriceCents: item.baseUnitPriceCents,
      effectiveUnitPriceCents: item.effectiveUnitPriceCents,
      lineSubtotalCents: item.lineSubtotalCents,
    })),
    pricing: order.pricing,
    fulfillment: order.fulfillment,
    transactionIds: order.transactionIds.map(String),
    statusHistory: order.statusHistory,
    notes: sensitive ? order.notes : null,
    internalNote: sensitive ? (order.internalNote ?? null) : null,
    refundFollowUpRequired: order.refundFollowUpRequired ?? false,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

type ManagementContext = Readonly<{ requestId: string; userAgent: string | null }>;

export function createOrderManagement(connection: Connection, context: ManagementContext) {
  const Order = getOrderModel(connection);
  const audit = async (
    session: ClientSession,
    actor: OrderAdmin,
    order: OrderRecord & { _id: Types.ObjectId },
    action: "order.order.status-change" | "crud.resource.update",
    details: Readonly<Record<string, string | number | boolean | null>>,
  ) => {
    await recordAuditEvent(
      connection,
      {
        action,
        actor: { kind: "admin", ref: actor.id, snapshot: { displayName: null, role: actor.role } },
        resource: {
          kind: "order",
          ref: order._id.toString(),
          snapshot: { code: order.code, label: null, status: order.status },
        },
        outcome: "success",
        requestId: context.requestId,
        context: details,
        network: { policy: "omitted", ipHash: null, ipAddress: null },
        userAgent: context.userAgent,
      },
      { session },
    );
  };
  const load = async (code: string, session?: ClientSession) => {
    let query = Order.findOne({ code });
    if (session) query = query.session(session);
    const order = await query;
    if (!order) throw new OrderManagementError("not_found");
    return order;
  };
  return {
    async list(
      actor: OrderAdmin,
      input: Readonly<{
        page: number;
        pageSize: number;
        status?: OrderStatus;
        customerId?: string;
        search?: string;
        searchMode?: "code" | "customer" | "mobile";
        from?: string;
        to?: string;
        paymentStatus?: TransactionStatus;
        sortBy?: "createdAt" | "code" | "totalCents";
        sortDirection: "asc" | "desc";
      }>,
    ) {
      requirePermission(actor, "orders:read");
      const sensitive = hasAdminPermission(actor, "orders:read-sensitive");
      if (input.search && input.searchMode && input.searchMode !== "code" && !sensitive)
        throw new OrderManagementError("forbidden");
      const baseFilter: Record<string, unknown> = {};
      if (input.customerId) baseFilter.customerId = new Types.ObjectId(input.customerId);
      if (input.from || input.to) {
        const createdAt: Record<string, Date> = {};
        if (input.from) createdAt.$gte = new Date(`${input.from}T00:00:00.000Z`);
        if (input.to) {
          const end = new Date(`${input.to}T00:00:00.000Z`);
          end.setUTCDate(end.getUTCDate() + 1);
          createdAt.$lt = end;
        }
        baseFilter.createdAt = createdAt;
      }
      if (input.paymentStatus) {
        baseFilter.$expr = {
          $eq: [{ $arrayElemAt: ["$statusHistory.paymentStatus", -1] }, input.paymentStatus],
        };
      }
      if (input.search) {
        const escaped = escapeSearchPattern(input.search);
        switch (input.searchMode ?? "code") {
          case "code":
            baseFilter.code = { $regex: `^${escapeSearchPattern(input.search.toUpperCase())}` };
            break;
          case "customer":
            if (input.search.trim().includes(" ")) {
              const [first, ...lastParts] = input.search.trim().split(/\s+/u);
              const last = lastParts.join(" ");
              baseFilter.$and = [
                {
                  "customerSnapshot.firstName": {
                    $regex: `^${escapeSearchPattern(first!)}`,
                    $options: "i",
                  },
                },
                {
                  "customerSnapshot.lastName": {
                    $regex: `^${escapeSearchPattern(last)}`,
                    $options: "i",
                  },
                },
              ];
            } else {
              baseFilter.$or = [
                { "customerSnapshot.firstName": { $regex: `^${escaped}`, $options: "i" } },
                { "customerSnapshot.lastName": { $regex: `^${escaped}`, $options: "i" } },
              ];
            }
            break;
          case "mobile":
            baseFilter["customerSnapshot.mobile"] = { $regex: `^${escaped}` };
            break;
        }
      }
      const filter = input.status ? { ...baseFilter, status: input.status } : baseFilter;
      const direction = input.sortDirection === "asc" ? 1 : -1;
      const sortField =
        input.sortBy === "code"
          ? "code"
          : input.sortBy === "totalCents"
            ? "pricing.totalCents"
            : "createdAt";
      const [orders, total, summary] = await Promise.all([
        Order.find(filter)
          .sort({ [sortField]: direction, _id: direction })
          .skip((input.page - 1) * input.pageSize)
          .limit(input.pageSize),
        Order.countDocuments(filter),
        Order.aggregate<{
          _id: OrderStatus;
          count: number;
          amountCents: number;
        }>([
          { $match: baseFilter },
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 },
              amountCents: { $sum: "$pricing.totalCents" },
            },
          },
        ]),
      ]);
      const statusCounts = Object.fromEntries(
        ORDER_STATUSES.map((status) => [
          status,
          summary.find((row) => row._id === status)?.count ?? 0,
        ]),
      ) as Record<OrderStatus, number>;
      return {
        items: orders.map((order) => view(order, sensitive)),
        total,
        statusCounts,
        allCount: summary.reduce((sum, row) => sum + row.count, 0),
        allAmountCents: summary.reduce((sum, row) => sum + row.amountCents, 0),
      };
    },
    async get(actor: OrderAdmin, code: string) {
      requirePermission(actor, "orders:read");
      return view(await load(code), hasAdminPermission(actor, "orders:read-sensitive"));
    },
    async setInternalNote(
      actor: OrderAdmin,
      code: string,
      input: {
        expectedRevision: number;
        expectedManagementRevision: number;
        internalNote: string | null;
      },
    ) {
      requirePermission(actor, "orders:update");
      return withMongoTransaction(connection, async (session) => {
        const order = await load(code, session);
        if (
          order.revision !== input.expectedRevision ||
          (order.managementRevision ?? 0) !== input.expectedManagementRevision
        )
          throw new OrderManagementError("conflict");
        order.internalNote = input.internalNote;
        order.managementRevision = (order.managementRevision ?? 0) + 1;
        await order.save({ session });
        await audit(session, actor, order, "crud.resource.update", { field: "internalNote" });
        return view(order, hasAdminPermission(actor, "orders:read-sensitive"));
      });
    },
    async transition(
      actor: OrderAdmin,
      code: string,
      input: { expectedRevision: number; status: OrderStatus; reasonCode: string | null },
    ) {
      requirePermission(actor, input.status === "cancelled" ? "orders:cancel" : "orders:update");
      return withMongoTransaction(connection, async (session) => {
        const order = await load(code, session);
        if (order.revision !== input.expectedRevision) throw new OrderManagementError("conflict");
        const latestId = order.transactionIds.at(-1)?.toString();
        const payment = latestId ? await getOrderPaymentView(connection, latestId, session) : null;
        if (
          !payment ||
          payment.orderId !== order._id.toString() ||
          payment.customerId !== order.customerId.toString() ||
          payment.currency !== "EUR" ||
          payment.requestedCents !== order.pricing.totalCents
        )
          throw new OrderManagementError("conflict");
        const effects = planOrderTransition({
          from: order.status,
          to: input.status,
          method: order.fulfillment.method,
          paymentStatus: payment.status,
          priorPaymentStatus: order.statusHistory.at(-1)!.paymentStatus,
          actor: { kind: "admin", adminId: actor.id, role: actor.role, active: actor.active },
          orderCustomerId: order.customerId.toString(),
          reasonCode: input.reasonCode,
        });
        const at = new Date();
        order.status = input.status;
        order.statusHistory.push({
          eventKey: `admin:${randomUUID()}`,
          status: input.status,
          actorKind: "admin",
          actorId: new Types.ObjectId(actor.id),
          reasonCode: input.reasonCode,
          paymentStatus: payment.status,
          occurredAt: at,
          recordedAt: at,
        });
        order.revision = order.statusHistory.length;
        if (input.status === "completed") order.fulfillment.completedAt = at;
        if (effects.refundFollowUpRequired) order.refundFollowUpRequired = true;
        await order.save({ session });
        await queueOrderNotifications(
          connection,
          order,
          order.statusHistory.at(-1)!.eventKey,
          effects.notificationIntents,
          session,
        );
        if (effects.recomputeSoldCount) {
          const lifecycle = soldCountLifecycle({
            status: order.status,
            paymentStatus: payment.status,
          });
          await createDishSoldCountProjector(connection).project(
            {
              orderId: order._id.toString(),
              revision: order.revision,
              ...lifecycle,
              items: order.items.map((item) => ({
                dishId: item.dishId.toString(),
                quantity: item.quantity,
              })),
            },
            session,
          );
        }
        await audit(session, actor, order, "order.order.status-change", {
          from: order.statusHistory.at(-2)!.status,
          to: input.status,
          refundFollowUpRequired: effects.refundFollowUpRequired,
        });
        return { order: view(order, hasAdminPermission(actor, "orders:read-sensitive")), effects };
      });
    },
    async attachTransaction(
      actor: OrderAdmin,
      code: string,
      input: {
        expectedRevision: number;
        expectedManagementRevision: number;
        transactionId: string;
      },
    ) {
      requirePermission(actor, "transactions:reconcile");
      return withMongoTransaction(connection, async (session) => {
        const order = await load(code, session);
        if (
          order.revision !== input.expectedRevision ||
          (order.managementRevision ?? 0) !== input.expectedManagementRevision
        )
          throw new OrderManagementError("conflict");
        if (order.transactionIds.some((id) => id.toString() === input.transactionId))
          return view(order, hasAdminPermission(actor, "orders:read-sensitive"));
        if (order.transactionIds.length >= 20 || order.status !== "pending_payment")
          throw new OrderManagementError("conflict");
        const oldId = order.transactionIds.at(-1)!.toString();
        const oldPayment = await getOrderPaymentView(connection, oldId, session);
        const newPayment = await getOrderPaymentView(connection, input.transactionId, session);
        if (
          !oldPayment ||
          !["failed", "cancelled", "expired"].includes(oldPayment.status) ||
          !newPayment ||
          newPayment.status !== "created" ||
          newPayment.orderId !== order._id.toString() ||
          newPayment.customerId !== order.customerId.toString() ||
          newPayment.currency !== "EUR" ||
          newPayment.requestedCents !== order.pricing.totalCents
        )
          throw new OrderManagementError("conflict");
        order.transactionIds.push(new Types.ObjectId(input.transactionId));
        order.managementRevision = (order.managementRevision ?? 0) + 1;
        await order.save({ session });
        await audit(session, actor, order, "crud.resource.update", {
          field: "transactionIds",
          transactionId: input.transactionId,
        });
        return view(order, hasAdminPermission(actor, "orders:read-sensitive"));
      });
    },
    async cancelCustomer(
      customerId: string,
      code: string,
      input: { expectedRevision: number; reasonCode: string },
    ) {
      return withMongoTransaction(connection, async (session) => {
        const order = await load(code, session);
        if (order.customerId.toString() !== customerId) throw new OrderManagementError("not_found");
        if (order.revision !== input.expectedRevision) throw new OrderManagementError("conflict");
        const latestId = order.transactionIds.at(-1)?.toString();
        const payment = latestId ? await getOrderPaymentView(connection, latestId, session) : null;
        if (
          !payment ||
          payment.orderId !== order._id.toString() ||
          payment.customerId !== customerId ||
          payment.currency !== "EUR" ||
          payment.requestedCents !== order.pricing.totalCents
        )
          throw new OrderManagementError("conflict");
        const effects = planOrderTransition({
          from: order.status,
          to: "cancelled",
          method: order.fulfillment.method,
          paymentStatus: payment.status,
          priorPaymentStatus: order.statusHistory.at(-1)!.paymentStatus,
          actor: { kind: "customer", customerId },
          orderCustomerId: order.customerId.toString(),
          reasonCode: input.reasonCode,
        });
        const at = new Date();
        order.status = "cancelled";
        order.statusHistory.push({
          eventKey: `customer:${randomUUID()}`,
          status: "cancelled",
          actorKind: "customer",
          actorId: new Types.ObjectId(customerId),
          reasonCode: input.reasonCode,
          paymentStatus: payment.status,
          occurredAt: at,
          recordedAt: at,
        });
        order.revision = order.statusHistory.length;
        await order.save({ session });
        await queueOrderNotifications(
          connection,
          order,
          order.statusHistory.at(-1)!.eventKey,
          effects.notificationIntents,
          session,
        );
        await recordAuditEvent(
          connection,
          {
            action: "order.order.status-change",
            actor: {
              kind: "customer",
              ref: customerId,
              snapshot: { displayName: null, role: null },
            },
            resource: {
              kind: "order",
              ref: order._id.toString(),
              snapshot: { code: order.code, label: null, status: order.status },
            },
            outcome: "success",
            requestId: context.requestId,
            context: { from: "pending_payment", to: "cancelled" },
            network: { policy: "omitted", ipHash: null, ipAddress: null },
            userAgent: context.userAgent,
          },
          { session },
        );
        return {
          order: { ...view(order, true), internalNote: null, refundFollowUpRequired: false },
          effects,
        };
      });
    },
    assignCustomer(actor: OrderAdmin): never {
      requirePermission(actor, "orders:update");
      // Customer identity and snapshot are fixed at checkout; an account link would rewrite history.
      throw new OrderManagementError("conflict");
    },
  };
}
