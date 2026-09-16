import "server-only";

import { isValidObjectId } from "mongoose";
import type { Connection, Types } from "mongoose";

import {
  PASSWORD_ARGON2_OPTIONS,
  hashPassword,
  isPasswordHash,
  verifyAndUpgradePassword,
} from "@/server/security/password";

import { getAdminModel } from "../model/admin";

export const ADMIN_ARGON2_OPTIONS = PASSWORD_ARGON2_OPTIONS;
export const isAdminPasswordHash = isPasswordHash;
export const hashAdminPassword = hashPassword;

/** Called after Auth resolves an administrator identifier; disabled accounts fail closed. */
export async function verifyAdminPasswordForLogin(
  connection: Connection,
  adminId: string | Types.ObjectId,
  password: string,
): Promise<boolean> {
  if (!isValidObjectId(adminId)) return false;
  const Admin = getAdminModel(connection);
  const admin = await Admin.findOne({ _id: adminId, active: true }).select("+passwordHash").exec();
  if (!admin?.passwordHash) return false;
  return verifyAndUpgradePassword(password, admin.passwordHash, async (oldHash, newHash) => {
    const updated = await Admin.updateOne(
      { _id: adminId, active: true, passwordHash: oldHash },
      { $set: { passwordHash: newHash } },
      { runValidators: true },
    );
    return updated.matchedCount === 1;
  });
}
