/** Public entry point for administrator identity management. */
export const MODULE_NAME = "admins" as const;
export { AdminPermissionDeniedError, requireAdminPermission } from "./policy/authorization";
export {
  ADMIN_PERMISSIONS,
  ADMIN_ROLES,
  ROLE_PERMISSIONS,
  hasAdminPermission,
  isAdminRole,
  permissionsForRole,
  type AdminAccessActor,
  type AdminPermission,
  type AdminRole,
} from "@/constants/admin-access";
