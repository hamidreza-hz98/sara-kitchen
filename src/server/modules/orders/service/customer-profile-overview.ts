import "server-only";

import { Types } from "mongoose";
import type { Connection } from "mongoose";

import { ORDER_INDEX_NAMES, type OrderStatus } from "../model/order";

export type CustomerLatestOrder = Readonly<{
  code: string;
  status: OrderStatus;
  createdAt: string;
  totalCents: number;
}>;

export type CustomerProfileOrders = Readonly<{
  totalOrders: number;
  latestOrder: CustomerLatestOrder | null;
}>;

type LatestOrderRow = {
  code: string;
  status: OrderStatus;
  createdAt: Date;
  pricing?: { totalCents?: number };
};

/** Private, customer-scoped projection; never reads another customer's order. */
export async function readCustomerProfileOrders(
  connection: Connection,
  customerId: string,
): Promise<CustomerProfileOrders> {
  if (!Types.ObjectId.isValid(customerId)) throw new RangeError("Invalid customer ID.");
  const filter = { customerId: new Types.ObjectId(customerId) };
  const orders = connection.collection<LatestOrderRow>("orders");
  const [totalOrders, latest] = await Promise.all([
    orders.countDocuments(filter),
    orders.findOne(filter, {
      projection: { _id: 0, code: 1, status: 1, createdAt: 1, "pricing.totalCents": 1 },
      sort: { createdAt: -1, _id: -1 },
      hint: ORDER_INDEX_NAMES.customer,
    }),
  ]);
  return {
    totalOrders,
    latestOrder: latest
      ? {
          code: latest.code,
          status: latest.status,
          createdAt: latest.createdAt.toISOString(),
          totalCents: latest.pricing?.totalCents ?? 0,
        }
      : null,
  };
}
