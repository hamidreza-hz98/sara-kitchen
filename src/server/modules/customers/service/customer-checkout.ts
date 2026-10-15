import "server-only";

import { Types } from "mongoose";
import type { ClientSession, Connection } from "mongoose";

import { getCustomerModel } from "../model/customer";

export async function loadCustomerIdentityForCheckout(
  connection: Connection,
  customerId: string,
  session: ClientSession,
) {
  const customer = await getCustomerModel(connection)
    .findOne({ _id: new Types.ObjectId(customerId), status: "active", deletedAt: null })
    .session(session)
    .lean();
  if (!customer) return null;
  return {
    firstName: customer.firstName,
    lastName: customer.lastName,
    mobile: customer.mobile,
    email: customer.email,
  };
}
