import "server-only";

import { isValidObjectId } from "mongoose";
import type { Connection, Types } from "mongoose";

import { permissionsForRole, type AdminRole } from "@/constants/admin-access";

import { getAdminModel } from "../model/admin";
import { isValidAdminIdentifier, normalizeAdminIdentifier } from "../validation/admin-identity";

export type AdminLoginIdentity = {
  id: string;
  passwordVersion: number;
};

export type ActiveAdminIdentity = AdminLoginIdentity & {
  displayName: string;
  role: AdminRole;
  permissions: ReturnType<typeof permissionsForRole>;
};

export async function findAdminForLogin(
  connection: Connection,
  suppliedIdentifier: string,
): Promise<AdminLoginIdentity | null> {
  const identifier = normalizeAdminIdentifier(suppliedIdentifier);
  if (!isValidAdminIdentifier(identifier)) return null;
  const admin = await getAdminModel(connection)
    .findOne({ identifier, active: true })
    .select("_id passwordVersion")
    .lean()
    .exec();
  return admin ? { id: admin._id.toHexString(), passwordVersion: admin.passwordVersion } : null;
}

export async function getActiveAdminIdentity(
  connection: Connection,
  adminId: string | Types.ObjectId,
): Promise<ActiveAdminIdentity | null> {
  if (!isValidObjectId(adminId)) return null;
  const admin = await getAdminModel(connection)
    .findOne({ _id: adminId, active: true })
    .select("_id firstName lastName role passwordVersion")
    .lean()
    .exec();
  if (!admin) return null;
  return {
    id: admin._id.toHexString(),
    displayName: `${admin.firstName} ${admin.lastName}`,
    role: admin.role,
    permissions: permissionsForRole(admin.role),
    passwordVersion: admin.passwordVersion,
  };
}

export async function recordAdminLastLogin(
  connection: Connection,
  adminId: string | Types.ObjectId,
  at: Date,
): Promise<boolean> {
  if (!isValidObjectId(adminId)) return false;
  const result = await getAdminModel(connection).updateOne(
    { _id: adminId, active: true },
    { $set: { lastLoginAt: at } },
  );
  return result.matchedCount === 1;
}
