/** Public entry point for administrator identity management. */
export const MODULE_NAME = "admins" as const;
export { AdminPermissionDeniedError, requireAdminPermission } from "./policy/authorization";
export {
  findAdminForLogin,
  getActiveAdminIdentity,
  recordAdminLastLogin,
  type ActiveAdminIdentity,
  type AdminLoginIdentity,
} from "./service/admin-login";
export { hashAdminPassword, verifyAdminPasswordForLogin } from "./service/password";
export { normalizeAdminIdentifier } from "./validation/admin-identity";
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
