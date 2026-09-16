import "server-only";

import {
  hasAdminPermission,
  type AdminAccessActor,
  type AdminPermission,
} from "@/constants/admin-access";

export class AdminPermissionDeniedError extends Error {
  readonly code = "ADMIN_PERMISSION_DENIED";

  constructor() {
    super("Administrator permission denied");
    this.name = "AdminPermissionDeniedError";
  }
}

/** Call after resolving the active administrator from a verified server session. */
export function requireAdminPermission(actor: AdminAccessActor, permission: AdminPermission): void {
  if (!hasAdminPermission(actor, permission)) throw new AdminPermissionDeniedError();
}
