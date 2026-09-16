import "server-only";

import { isValidObjectId } from "mongoose";
import type { Connection } from "mongoose";

import { getCustomerModel } from "../model/customer";
import { normalizeCustomerEmail, normalizeCustomerMobile } from "../validation/customer-identity";

export type CustomerLoginIdentity = { id: string; passwordVersion: number };
export type ActiveCustomerIdentity = CustomerLoginIdentity & { displayName: string };

export async function findCustomerForLogin(
  connection: Connection,
  identifier: string,
): Promise<CustomerLoginIdentity | null> {
  const field = identifier.includes("@") ? "email" : "mobile";
  const normalized =
    field === "email" ? normalizeCustomerEmail(identifier) : normalizeCustomerMobile(identifier);
  if (!normalized) return null;
  const record = await getCustomerModel(connection)
    .findOne({ [field]: normalized, status: "active" })
    .select("_id passwordVersion")
    .lean()
    .exec();
  return record ? { id: record._id.toHexString(), passwordVersion: record.passwordVersion } : null;
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
