import "server-only";

import type { Connection } from "mongoose";

import { hasAdminPermission, type AdminPermission } from "@/constants/admin-access";
import type { ActiveAdminIdentity } from "@/server/modules/admins";
import type { ActiveCustomerIdentity } from "@/server/modules/customers";

import { resolveAdminActor } from "../service/admin-session";
import { resolveCustomerActor } from "../service/customer-session";

export class AuthorizationGuardError extends Error {
  constructor(readonly reason: "unauthenticated" | "forbidden" | "not-found") {
    super("Access denied.");
    this.name = "AuthorizationGuardError";
  }
}

/** Resolve identity from the database-backed session on every protected request. */
export async function requireAdminActor(
  connection: Connection,
  token: string | undefined,
  permission?: AdminPermission,
): Promise<ActiveAdminIdentity> {
  const actor = await resolveAdminActor(connection, token);
  if (!actor) throw new AuthorizationGuardError("unauthenticated");
  if (permission && !hasAdminPermission({ role: actor.role, active: true }, permission)) {
    throw new AuthorizationGuardError("forbidden");
  }
  return actor;
}

export async function requireCustomerActor(
  connection: Connection,
  token: string | undefined,
): Promise<ActiveCustomerIdentity> {
  const actor = await resolveCustomerActor(connection, token);
  if (!actor) throw new AuthorizationGuardError("unauthenticated");
  return actor;
}

/** Use for object-level reads/writes; a guessed ID must never grant access. */
export function requireCustomerOwnership(
  actor: Pick<ActiveCustomerIdentity, "id">,
  ownerId: unknown,
): void {
  const value = typeof ownerId === "string" ? ownerId : String(ownerId ?? "");
  if (!/^[a-f\d]{24}$/iu.test(value) || actor.id.toLowerCase() !== value.toLowerCase()) {
    throw new AuthorizationGuardError("not-found");
  }
}

/** Unknown dashboard paths fail closed until an explicit server policy exists. */
const dashboardSectionPermissions = {
  media: "media:read",
  categories: "categories:read",
  dishes: "dishes:read",
  ingredients: "ingredients:read",
  customers: "customers:read",
  admins: "admins:read",
  orders: "orders:read",
  contact: "contacts:read",
  activity: "logs:read",
  settings: "settings:read",
  blog: "blogs:read",
  transactions: "transactions:read",
  sessions: "dashboard:view",
} as const satisfies Record<string, AdminPermission>;

export function dashboardPermissionForPath(segments: readonly string[]): AdminPermission {
  if (segments.length === 0) return "dashboard:view";
  const section = segments[0];
  if (!section || !Object.hasOwn(dashboardSectionPermissions, section)) {
    throw new AuthorizationGuardError("not-found");
  }
  return dashboardSectionPermissions[section as keyof typeof dashboardSectionPermissions];
}

export async function requireDashboardActor(
  connection: Connection,
  token: string | undefined,
  segments: readonly string[],
): Promise<ActiveAdminIdentity> {
  const actor = await requireAdminActor(connection, token, "dashboard:view");
  const permission = dashboardPermissionForPath(segments);
  if (!hasAdminPermission({ role: actor.role, active: true }, permission)) {
    throw new AuthorizationGuardError("forbidden");
  }
  return actor;
}
