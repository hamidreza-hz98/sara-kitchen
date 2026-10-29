import "server-only";

import type { Connection, PipelineStage, Types } from "mongoose";

import { getTransactionModel } from "../model/transaction";

export type DashboardFinancePeriod = Readonly<{ start: Date; end: Date }>;
export type DashboardFinanceBucket = Readonly<{
  date: string;
  grossCents: number;
  refundsCents: number;
}>;
export type DashboardCustomerSpend = Readonly<{
  customerId: string;
  grossCents: number;
  refundsCents: number;
  netCents: number;
  paidOrders: number;
}>;

type Row = {
  _id: { customerId: Types.ObjectId; orderId: Types.ObjectId; date: string };
  grossCents: number;
  refundsCents: number;
  paidOrders: number;
};

/** Owner-module read projection over verified, append-only monetary events. */
export async function readDashboardFinance(
  connection: Connection,
  period: DashboardFinancePeriod,
  timeZone: string,
): Promise<{
  grossCents: number;
  refundsCents: number;
  paidOrders: number;
  uniquePayingCustomers: number;
  buckets: DashboardFinanceBucket[];
  customers: DashboardCustomerSpend[];
}> {
  const pipeline: PipelineStage[] = [
    { $match: { "events.occurredAt": { $gte: period.start, $lt: period.end } } },
    { $unwind: "$events" },
    {
      $match: {
        "events.occurredAt": { $gte: period.start, $lt: period.end },
        "events.status": { $in: ["paid", "partially-refunded", "refunded"] },
      },
    },
    {
      $group: {
        _id: {
          customerId: "$customerId",
          orderId: "$orderId",
          date: {
            $dateToString: { format: "%Y-%m-%d", date: "$events.occurredAt", timezone: timeZone },
          },
        },
        grossCents: {
          $sum: { $cond: [{ $eq: ["$events.status", "paid"] }, "$events.amountCents", 0] },
        },
        refundsCents: {
          $sum: {
            $cond: [
              { $in: ["$events.status", ["partially-refunded", "refunded"]] },
              "$events.amountCents",
              0,
            ],
          },
        },
        paidOrders: { $max: { $cond: [{ $eq: ["$events.status", "paid"] }, 1, 0] } },
      },
    },
  ];
  const rows = await getTransactionModel(connection)
    .aggregate<Row>(pipeline)

    .option({ maxTimeMS: 5_000 });
  const bucketMap = new Map<string, { grossCents: number; refundsCents: number }>();
  const customerMap = new Map<string, DashboardCustomerSpend>();
  const capturedOrders = new Set<string>();
  const customerCapturedOrders = new Map<string, Set<string>>();
  let grossCents = 0;
  let refundsCents = 0;
  for (const row of rows) {
    grossCents += row.grossCents;
    refundsCents += row.refundsCents;
    const bucket = bucketMap.get(row._id.date) ?? { grossCents: 0, refundsCents: 0 };
    bucket.grossCents += row.grossCents;
    bucket.refundsCents += row.refundsCents;
    bucketMap.set(row._id.date, bucket);
    const customerId = row._id.customerId.toString();
    if (row.paidOrders > 0) {
      const orderId = row._id.orderId.toString();
      capturedOrders.add(orderId);
      const customerOrders = customerCapturedOrders.get(customerId) ?? new Set<string>();
      customerOrders.add(orderId);
      customerCapturedOrders.set(customerId, customerOrders);
    }
    const customer = customerMap.get(customerId) ?? {
      customerId,
      grossCents: 0,
      refundsCents: 0,
      netCents: 0,
      paidOrders: 0,
    };
    customerMap.set(customerId, {
      customerId,
      grossCents: customer.grossCents + row.grossCents,
      refundsCents: customer.refundsCents + row.refundsCents,
      netCents: customer.netCents + row.grossCents - row.refundsCents,
      paidOrders: customerCapturedOrders.get(customerId)?.size ?? 0,
    });
  }
  const customers = [...customerMap.values()].sort(
    (a, b) =>
      b.netCents - a.netCents ||
      b.grossCents - a.grossCents ||
      b.paidOrders - a.paidOrders ||
      a.customerId.localeCompare(b.customerId),
  );
  return {
    grossCents,
    refundsCents,
    paidOrders: capturedOrders.size,
    uniquePayingCustomers: customerCapturedOrders.size,
    buckets: [...bucketMap]
      .map(([date, values]) => ({ date, ...values }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    customers,
  };
}
