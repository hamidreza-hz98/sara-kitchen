import "server-only";

import { Types } from "mongoose";
import type { Connection } from "mongoose";

export type CustomerOrderSummary = Readonly<{
  orderCount: number;
  totalSpentCents: number;
  lastOrderAt: string | null;
}>;

type OrderSummaryRow = Readonly<{
  customerId?: Types.ObjectId | string;
  customer?: Readonly<{ id?: string; ref?: Types.ObjectId | string }>;
  status?: string;
  totalCents?: number;
  price?: Readonly<{ totalCents?: number }>;
  pricing?: Readonly<{ totalCents?: number }>;
  createdAt?: Date | string;
}>;

const PAID_STATUSES = new Set(["paid", "completed"]);

function customerIdFrom(row: OrderSummaryRow): string | null {
  const value = row.customerId ?? row.customer?.id ?? row.customer?.ref;
  if (value instanceof Types.ObjectId) return value.toHexString();
  return typeof value === "string" && Types.ObjectId.isValid(value)
    ? new Types.ObjectId(value).toHexString()
    : null;
}

function totalCentsFrom(row: OrderSummaryRow): number {
  const value = row.totalCents ?? row.pricing?.totalCents ?? row.price?.totalCents;
  return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : 0;
}

/** Page-sized aggregate owned by Orders so Customers never reads order storage directly. */
export async function summarizeOrdersForCustomers(
  connection: Connection,
  customerIds: readonly string[],
): Promise<Readonly<Record<string, CustomerOrderSummary>>> {
  const normalizedIds = [...new Set(customerIds)]
    .filter((id) => Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id).toHexString());
  const summaries: Record<string, CustomerOrderSummary> = Object.fromEntries(
    normalizedIds.map((id) => [id, { orderCount: 0, totalSpentCents: 0, lastOrderAt: null }]),
  );
  if (normalizedIds.length === 0) return summaries;

  const objectIds = normalizedIds.map((id) => new Types.ObjectId(id));
  const rows = (await connection
    .collection("orders")
    .find(
      {
        $or: [
          { customerId: { $in: objectIds } },
          { "customer.id": { $in: normalizedIds } },
          { "customer.ref": { $in: objectIds } },
        ],
      },
      {
        projection: {
          _id: 0,
          customerId: 1,
          "customer.id": 1,
          "customer.ref": 1,
          status: 1,
          totalCents: 1,
          "price.totalCents": 1,
          "pricing.totalCents": 1,
          createdAt: 1,
        },
      },
    )
    .toArray()) as OrderSummaryRow[];

  for (const row of rows) {
    const customerId = customerIdFrom(row);
    if (!customerId || !summaries[customerId]) continue;
    const current = summaries[customerId];
    const createdAt = row.createdAt ? new Date(row.createdAt) : null;
    const validCreatedAt = createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt : null;
    const previousLast = current.lastOrderAt ? new Date(current.lastOrderAt) : null;
    summaries[customerId] = {
      orderCount: current.orderCount + 1,
      totalSpentCents:
        current.totalSpentCents + (PAID_STATUSES.has(row.status ?? "") ? totalCentsFrom(row) : 0),
      lastOrderAt:
        validCreatedAt && (!previousLast || validCreatedAt > previousLast)
          ? validCreatedAt.toISOString()
          : current.lastOrderAt,
    };
  }

  return summaries;
}
