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
export { createAdminRepository, AdminRepositoryConflictError } from "./repository/admin";
export type {
  AdminListOptions,
  AdminListResult,
  AdminRepository,
  AdminSnapshot,
  AdminWrite,
} from "./repository/admin";
export { createAdminCrudServices, AdminCrudError } from "./service/admin-crud";
export type {
  AdminCreateInput,
  AdminCrudAction,
  AdminCrudActor,
  AdminCrudAuditEvent,
  AdminCrudDependencies,
  AdminManagementView,
  AdminUpdateInput,
} from "./service/admin-crud";
export { createAdminAuditSink } from "./service/admin-audit";
export {
  adminCreateSchema,
  adminCredentialResetSchema,
  adminEmptyMutationSchema,
  adminIdParametersSchema,
  adminListQuerySchema,
  adminUpdateSchema,
} from "./validation/admin-request";
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
