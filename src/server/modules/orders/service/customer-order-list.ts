import "server-only";

import { Types } from "mongoose";
import type { Connection } from "mongoose";

import { ORDER_INDEX_NAMES, ORDER_STATUSES, type OrderStatus } from "../model/order";
import { ORDER_CODE_PATTERN } from "../policy/order-code";
import type {
  CustomerOrderListInput,
  CustomerOrderListItem,
  CustomerOrderListResult,
  CustomerOrderTab,
} from "@/types/customer-order";

export type {
  CustomerOrderListInput,
  CustomerOrderListItem,
  CustomerOrderListResult,
  CustomerOrderTab,
} from "@/types/customer-order";

export const CUSTOMER_ORDER_TABS = ["all", "active", "completed", "closed"] as const;

const TAB_STATUSES: Readonly<Record<Exclude<CustomerOrderTab, "all">, readonly OrderStatus[]>> = {
  active: ["pending_payment", "confirmed", "preparing", "ready", "out_for_delivery"],
  completed: ["completed"],
  closed: ["payment_failed", "cancelled", "expired", "refunded"],
};

type OrderListRow = {
  customerId?: Types.ObjectId;
  code: string;
  status: OrderStatus;
  createdAt: Date;
  pricing?: { totalCents?: number };
  fulfillment?: { method?: "pickup" | "delivery" };
  items?: { name?: string; quantity?: number }[];
};

type StatusCount = { _id: OrderStatus; count: number };

export function customerOrderStatusFilter(
  tab: CustomerOrderTab,
  status?: OrderStatus,
): OrderStatus | { $in: OrderStatus[] } | undefined {
  if (status && !ORDER_STATUSES.includes(status)) throw new RangeError("Invalid order status.");
  if (!CUSTOMER_ORDER_TABS.includes(tab)) throw new RangeError("Invalid order tab.");
  if (status) {
    return tab === "all" || TAB_STATUSES[tab].includes(status) ? status : { $in: [] };
  }
  return tab === "all" ? undefined : { $in: [...TAB_STATUSES[tab]] };
}

function project(row: OrderListRow): CustomerOrderListItem {
  const items = (row.items ?? [])
    .filter((item) => typeof item.name === "string" && Number.isSafeInteger(item.quantity))
    .map((item) => ({ name: item.name!, quantity: item.quantity! }));
  return {
    code: row.code,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    totalCents: row.pricing?.totalCents ?? 0,
    fulfillmentMethod: row.fulfillment?.method === "delivery" ? "delivery" : "pickup",
    itemCount: items.reduce((total, item) => total + item.quantity, 0),
    items,
  };
}

/** Private, bounded order snapshot projection. Every data query is scoped to the authenticated customer. */
export async function listCustomerOrders(
  connection: Connection,
  input: CustomerOrderListInput,
): Promise<CustomerOrderListResult> {
  if (!Types.ObjectId.isValid(input.customerId) || !/^[a-f\d]{24}$/iu.test(input.customerId))
    throw new RangeError("Invalid customer ID.");
  if (
    !Number.isSafeInteger(input.page) ||
    input.page < 1 ||
    input.page > 1000 ||
    !Number.isSafeInteger(input.pageSize) ||
    input.pageSize < 1 ||
    input.pageSize > 20
  )
    throw new RangeError("Invalid customer order pagination.");
  const customerId = new Types.ObjectId(input.customerId);
  const statusFilter = customerOrderStatusFilter(input.tab, input.status);
  const filter = { customerId, ...(statusFilter !== undefined ? { status: statusFilter } : {}) };
  const orders = connection.collection<OrderListRow>("orders");
  const [rows, total, statusCounts] = await Promise.all([
    orders
      .find(filter, {
        projection: {
          _id: 0,
          code: 1,
          status: 1,
          createdAt: 1,
          "pricing.totalCents": 1,
          "fulfillment.method": 1,
          "items.name": 1,
          "items.quantity": 1,
        },
        sort: { createdAt: -1, _id: -1 },
        skip: (input.page - 1) * input.pageSize,
        limit: input.pageSize,
        hint: ORDER_INDEX_NAMES.customer,
        maxTimeMS: 5000,
      })
      .toArray(),
    orders.countDocuments(filter, { hint: ORDER_INDEX_NAMES.customer, maxTimeMS: 5000 }),
    orders
      .aggregate<StatusCount>(
        [{ $match: { customerId } }, { $group: { _id: "$status", count: { $sum: 1 } } }],
        { hint: ORDER_INDEX_NAMES.customer, maxTimeMS: 5000 },
      )
      .toArray(),
  ]);
  const byStatus = new Map(statusCounts.map(({ _id, count }) => [_id, count]));
  return {
    items: rows.map(project),
    page: input.page,
    pageSize: input.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
    counts: {
      all: statusCounts.reduce((sum, row) => sum + row.count, 0),
      active: TAB_STATUSES.active.reduce((sum, status) => sum + (byStatus.get(status) ?? 0), 0),
      completed: byStatus.get("completed") ?? 0,
      closed: TAB_STATUSES.closed.reduce((sum, status) => sum + (byStatus.get(status) ?? 0), 0),
    },
  };
}

export async function getCustomerOrderSummaryByCode(
  connection: Connection,
  customerId: string,
  code: string,
): Promise<CustomerOrderListItem | null> {
  if (
    !Types.ObjectId.isValid(customerId) ||
    !/^[a-f\d]{24}$/iu.test(customerId) ||
    !ORDER_CODE_PATTERN.test(code)
  )
    return null;
  const row = await connection.collection<OrderListRow>("orders").findOne(
    { customerId: new Types.ObjectId(customerId), code },
    {
      projection: {
        _id: 0,
        code: 1,
        status: 1,
        createdAt: 1,
        "pricing.totalCents": 1,
        "fulfillment.method": 1,
        "items.name": 1,
        "items.quantity": 1,
      },
      hint: ORDER_INDEX_NAMES.code,
      maxTimeMS: 5000,
    },
  );
  return row ? project(row) : null;
}
