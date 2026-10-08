import "server-only";

import { Types } from "mongoose";
import type { Connection } from "mongoose";

function customerFilter(customerId: string) {
  if (!Types.ObjectId.isValid(customerId)) return { _id: { $exists: false } };
  const objectId = new Types.ObjectId(customerId);
  return {
    $or: [{ customerId: objectId }, { "customer.id": customerId }, { "customer.ref": objectId }],
  };
}

/** Orders owns historical-order discovery; Customers never reaches into the order collection. */
export async function countHistoricalOrdersForCustomer(
  connection: Connection,
  customerId: string,
): Promise<number> {
  return connection.collection("orders").countDocuments(customerFilter(customerId));
}

/** Explicit allow-list prevents payment/provider internals from entering a privacy export. */
export async function exportOrderHistoryForCustomer(
  connection: Connection,
  customerId: string,
): Promise<readonly Record<string, unknown>[]> {
  return connection
    .collection("orders")
    .find(customerFilter(customerId), {
      projection: {
        _id: 0,
        code: 1,
        status: 1,
        items: 1,
        customerSnapshot: 1,
        addressSnapshot: 1,
        pricing: 1,
        statusHistory: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    })
    .sort({ createdAt: -1, _id: -1 })
    .toArray();
}
