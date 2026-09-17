import "server-only";

import type { Connection } from "mongoose";

import { hashPassword, verifyPassword } from "@/server/security/password";

import { getCustomerModel } from "../model/customer";

export type CustomerPasswordChangeOutcome =
  "changed" | "invalid-current" | "same-password" | "stale";

/** Compare-and-set prevents an older session from overwriting a concurrent credential change. */
export async function changeCustomerPassword(
  connection: Connection,
  customerId: string,
  expectedVersion: number,
  currentPassword: string,
  newPassword: string,
): Promise<CustomerPasswordChangeOutcome> {
  const Customer = getCustomerModel(connection);
  const customer = await Customer.findOne({
    _id: customerId,
    status: "active",
    passwordVersion: expectedVersion,
  })
    .select("+passwordHash passwordVersion")
    .exec();
  if (!customer?.passwordHash) return "stale";
  if (!(await verifyPassword(currentPassword, customer.passwordHash)).verified)
    return "invalid-current";
  if (currentPassword === newPassword) return "same-password";
  const passwordHash = await hashPassword(newPassword);
  const updated = await Customer.updateOne(
    {
      _id: customerId,
      status: "active",
      passwordVersion: expectedVersion,
      passwordHash: customer.passwordHash,
    },
    { $set: { passwordHash }, $inc: { passwordVersion: 1 } },
    { runValidators: true },
  );
  return updated.matchedCount === 1 ? "changed" : "stale";
}
