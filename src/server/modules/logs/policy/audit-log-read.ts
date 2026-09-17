import { isValidObjectId } from "mongoose";

import type { AdminPermission } from "@/constants/admin-access";

import { isSafeAuditText } from "../validation/audit-event";

export type AuditLogReadPrincipal = Readonly<{
  active: true;
  displayName: string;
  id: string;
  kind: "admin";
  permissions: readonly AdminPermission[];
  role: string;
}>;

export class AuditLogReadForbiddenError extends Error {
  constructor() {
    super("Audit-log access is denied.");
    this.name = "AuditLogReadForbiddenError";
  }
}

export function requireAuditLogReadPermission(principal: AuditLogReadPrincipal): void {
  if (
    principal.kind !== "admin" ||
    principal.active !== true ||
    !isValidObjectId(principal.id) ||
    !isSafeAuditText(principal.displayName, 120) ||
    !isSafeAuditText(principal.role, 64) ||
    !Array.isArray(principal.permissions) ||
    !principal.permissions.includes("logs:read")
  ) {
    throw new AuditLogReadForbiddenError();
  }
}
