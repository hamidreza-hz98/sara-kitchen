import "server-only";

import type { Connection, PipelineStage, Types } from "mongoose";

import { getOrderModel, ORDER_STATUSES, type OrderStatus } from "../model/order";

export type DashboardOrderPeriod = Readonly<{ start: Date; end: Date }>;
export type DashboardRecentOrder = Readonly<{
  code: string;
  status: OrderStatus;
  totalCents: number;
  createdAt: Date;
}>;
export type DashboardSoldDish = Readonly<{
  dishId: string;
  name: string;
  grossUnits: number;
  netUnits: number;
  netRevenueCents: number;
}>;

export function countDashboardOrdersCreated(
  connection: Connection,
  period: DashboardOrderPeriod,
): Promise<number> {
  return getOrderModel(connection)
    .countDocuments({ createdAt: { $gte: period.start, $lt: period.end } })

    .exec();
}

type SoldRow = {
  _id: Types.ObjectId;
  name: string;
  grossUnits: number;
  refundedUnits: number;
  netRevenueCents: number;
};

/** Read-only dashboard facts from immutable orders and their lifecycle history. */
export async function readDashboardOrders(connection: Connection, period: DashboardOrderPeriod) {
  const Order = getOrderModel(connection);
  const statusCounts = Object.fromEntries(ORDER_STATUSES.map((status) => [status, 0])) as Record<
    OrderStatus,
    number
  >;
  const [ordersCreated, statuses, recent, soldRows] = await Promise.all([
    countDashboardOrdersCreated(connection, period),
    Order.aggregate<{ _id: OrderStatus; count: number }>([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ])

      .option({ maxTimeMS: 5_000 }),
    Order.find({}, { code: 1, status: 1, "pricing.totalCents": 1, createdAt: 1 })
      .sort({ createdAt: -1, _id: -1 })

      .limit(8)
      .lean(),
    Order.aggregate<SoldRow>([
      { $match: { "statusHistory.occurredAt": { $gte: period.start, $lt: period.end } } },
      { $unwind: "$statusHistory" },
      {
        $match: {
          "statusHistory.occurredAt": { $gte: period.start, $lt: period.end },
          "statusHistory.status": { $in: ["completed", "refunded"] },
        },
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.dishId",
          name: { $first: "$items.name" },
          grossUnits: {
            $sum: {
              $cond: [{ $eq: ["$statusHistory.status", "completed"] }, "$items.quantity", 0],
            },
          },
          refundedUnits: {
            $sum: { $cond: [{ $eq: ["$statusHistory.status", "refunded"] }, "$items.quantity", 0] },
          },
          netRevenueCents: {
            $sum: {
              $cond: [
                { $eq: ["$statusHistory.status", "completed"] },
                "$items.lineSubtotalCents",
                { $multiply: [-1, "$items.lineSubtotalCents"] },
              ],
            },
          },
        },
      },
    ] as PipelineStage[])

      .option({ maxTimeMS: 5_000 }),
  ]);
  for (const row of statuses) statusCounts[row._id] = row.count;
  const topSelling = soldRows
    .map((row) => ({
      dishId: row._id.toString(),
      name: row.name,
      grossUnits: row.grossUnits,
      netUnits: row.grossUnits - row.refundedUnits,
      netRevenueCents: row.netRevenueCents,
    }))
    .filter((row) => row.netUnits > 0)
    .sort(
      (a, b) =>
        b.netUnits - a.netUnits ||
        b.grossUnits - a.grossUnits ||
        b.netRevenueCents - a.netRevenueCents ||
        a.dishId.localeCompare(b.dishId),
    )
    .slice(0, 5);
  return {
    ordersCreated,
    statusCounts,
    topSelling,
    recent: recent.map((row): DashboardRecentOrder => ({
      code: row.code,
      status: row.status,
      totalCents: row.pricing.totalCents,
      createdAt: row.createdAt,
    })),
  };
}
