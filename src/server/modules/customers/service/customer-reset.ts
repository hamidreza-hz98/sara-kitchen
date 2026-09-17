import "server-only";

import type { Connection } from "mongoose";

import { getCustomerModel } from "../model/customer";
import { normalizeCustomerEmail, normalizeCustomerMobile } from "../validation/customer-identity";

export type ResetCustomerIdentity = { id: string; mobile: string; passwordVersion: number };

export async function findCustomerForReset(
  connection: Connection,
  identifier: string,
): Promise<ResetCustomerIdentity | null> {
  const field = identifier.includes("@") ? "email" : "mobile";
  const value =
    field === "email" ? normalizeCustomerEmail(identifier) : normalizeCustomerMobile(identifier);
  if (!value) return null;
  const record = await getCustomerModel(connection)
    .findOne({ [field]: value, status: "active" })
    .select("mobile passwordVersion")
    .lean()
    .exec();
  return record
    ? {
        id: record._id.toHexString(),
        mobile: record.mobile,
        passwordVersion: record.passwordVersion,
      }
    : null;
}

export async function replaceCustomerPasswordAfterReset(
  connection: Connection,
  customerId: string,
  expectedVersion: number,
  passwordHash: string,
): Promise<boolean> {
  const result = await getCustomerModel(connection).updateOne(
    { _id: customerId, status: "active", passwordVersion: expectedVersion },
    { $set: { passwordHash }, $inc: { passwordVersion: 1 } },
    { runValidators: true },
  );
  return result.matchedCount === 1;
}
