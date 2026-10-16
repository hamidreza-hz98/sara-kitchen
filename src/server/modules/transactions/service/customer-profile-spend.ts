import "server-only";

import { Types } from "mongoose";
import type { Connection, PipelineStage } from "mongoose";

import { getTransactionModel, TRANSACTION_INDEX_NAMES } from "../model/transaction";

export type CustomerLifetimeSpend = Readonly<{
  grossCents: number;
  refundsCents: number;
  netCents: number;
}>;

type SpendRow = { grossCents: number; refundsCents: number };

/** Lifetime financial facts, consistent with dashboard capture-minus-refund accounting. */
export async function readCustomerLifetimeSpend(
  connection: Connection,
  customerId: string,
): Promise<CustomerLifetimeSpend> {
  if (!Types.ObjectId.isValid(customerId)) throw new RangeError("Invalid customer ID.");
  const pipeline: PipelineStage[] = [
    { $match: { customerId: new Types.ObjectId(customerId) } },
    { $unwind: "$events" },
    { $match: { "events.status": { $in: ["paid", "partially-refunded", "refunded"] } } },
    {
      $group: {
        _id: null,
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
      },
    },
  ];
  const [row] = await getTransactionModel(connection)
    .aggregate<SpendRow>(pipeline)
    .hint(TRANSACTION_INDEX_NAMES.customer)
    .option({ maxTimeMS: 5_000 });
  const grossCents = row?.grossCents ?? 0;
  const refundsCents = row?.refundsCents ?? 0;
  return { grossCents, refundsCents, netCents: grossCents - refundsCents };
}
