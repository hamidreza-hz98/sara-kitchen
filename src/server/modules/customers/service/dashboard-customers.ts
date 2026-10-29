import "server-only";

import { Types } from "mongoose";
import type { Connection } from "mongoose";

import { getCustomerModel } from "../model/customer";

export async function readDashboardCustomers(
  connection: Connection,
  period: Readonly<{ start: Date; end: Date }>,
  ids: readonly string[],
  includeNames: boolean,
) {
  const Customer = getCustomerModel(connection);
  const [registered, records] = await Promise.all([
    Customer.countDocuments({ createdAt: { $gte: period.start, $lt: period.end } }),
    includeNames && ids.length
      ? Customer.find(
          { _id: { $in: ids.slice(0, 5).map((id) => new Types.ObjectId(id)) } },
          { firstName: 1, lastName: 1, status: 1 },
        ).lean()
      : Promise.resolve([]),
  ]);
  const names = new Map(
    records.map((row) => [
      row._id.toString(),
      row.status === "anonymized" ? null : `${row.firstName} ${row.lastName}`,
    ]),
  );
  return { registered, names };
}
