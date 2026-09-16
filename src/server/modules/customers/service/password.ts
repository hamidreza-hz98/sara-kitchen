import "server-only";

import { isValidObjectId } from "mongoose";
import type { Connection, Types } from "mongoose";

import { hashPassword, isPasswordHash, verifyAndUpgradePassword } from "@/server/security/password";

import { getCustomerModel } from "../model/customer";

export const hashCustomerPassword = hashPassword;
export const isCustomerPasswordHash = isPasswordHash;

/** Called after Auth resolves a customer identifier; disabled accounts fail closed. */
export async function verifyCustomerPasswordForLogin(
  connection: Connection,
  customerId: string | Types.ObjectId,
  password: string,
): Promise<boolean> {
  if (!isValidObjectId(customerId)) return false;
  const Customer = getCustomerModel(connection);
  const customer = await Customer.findOne({ _id: customerId, status: "active" })
    .select("+passwordHash")
    .exec();
  if (!customer?.passwordHash) return false;
  return verifyAndUpgradePassword(password, customer.passwordHash, async (oldHash, newHash) => {
    const updated = await Customer.updateOne(
      { _id: customerId, status: "active", passwordHash: oldHash },
      { $set: { passwordHash: newHash } },
      { runValidators: true },
    );
    return updated.matchedCount === 1;
  });
}
