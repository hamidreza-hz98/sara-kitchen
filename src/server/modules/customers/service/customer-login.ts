import "server-only";

import { isValidObjectId } from "mongoose";
import type { Connection } from "mongoose";

import { getCustomerModel } from "../model/customer";
import { normalizeCustomerEmail, normalizeCustomerMobile } from "../validation/customer-identity";

export type CustomerLoginIdentity = { id: string; passwordVersion: number };
export type CustomerLoginCandidate = CustomerLoginIdentity & { mobileVerified: boolean };
export type ActiveCustomerIdentity = CustomerLoginIdentity & { displayName: string };

export async function findCustomerForLogin(
  connection: Connection,
  identifier: string,
): Promise<CustomerLoginCandidate | null> {
  const field = identifier.includes("@") ? "email" : "mobile";
  const normalized =
    field === "email" ? normalizeCustomerEmail(identifier) : normalizeCustomerMobile(identifier);
  if (!normalized) return null;
  const record = await getCustomerModel(connection)
    .findOne({ [field]: normalized, status: "active" })
    .select("_id passwordVersion mobileVerificationPendingAt")
    .lean()
    .exec();
  return record
    ? {
        id: record._id.toHexString(),
        mobileVerified: !record.mobileVerificationPendingAt,
        passwordVersion: record.passwordVersion,
      }
    : null;
}

export async function isActiveCustomerMobileVerified(
  connection: Connection,
  customerId: string,
): Promise<boolean> {
  if (!isValidObjectId(customerId)) return false;
  const record = await getCustomerModel(connection)
    .findOne({
      _id: customerId,
      status: "active",
      deletedAt: null,
      mobileVerifiedAt: { $ne: null },
    })
    .select("_id")
    .lean()
    .exec();
  return Boolean(record);
}

export async function getActiveCustomerIdentity(
  connection: Connection,
  customerId: string,
): Promise<ActiveCustomerIdentity | null> {
  if (!isValidObjectId(customerId)) return null;
  const record = await getCustomerModel(connection)
    .findOne({ _id: customerId, status: "active" })
    .select("firstName lastName passwordVersion")
    .lean()
    .exec();
  return record
    ? {
        id: record._id.toHexString(),
        passwordVersion: record.passwordVersion,
        displayName: `${record.firstName} ${record.lastName}`,
      }
    : null;
}
