import "server-only";

import { Types, type Connection } from "mongoose";

import { getCustomerModel } from "../model/customer";

/** Marks the matching active mobile as verified without exposing the customer document. */
export async function markCustomerMobileVerified(
  connection: Connection,
  customerId: string,
  mobile: string,
  now = new Date(),
): Promise<boolean> {
  if (!Types.ObjectId.isValid(customerId)) return false;
  const result = await getCustomerModel(connection).updateOne(
    {
      _id: new Types.ObjectId(customerId),
      mobile,
      status: "active",
      deletedAt: null,
      mobileVerifiedAt: null,
      mobileVerificationPendingAt: { $ne: null },
    },
    { $set: { mobileVerifiedAt: now, mobileVerificationPendingAt: null } },
  );
  return result.modifiedCount === 1;
}
