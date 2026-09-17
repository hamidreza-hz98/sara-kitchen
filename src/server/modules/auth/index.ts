/** Public entry point for authentication use cases. */
export const MODULE_NAME = "auth" as const;
export { adminCookieName, clearAdminCookie, serializeAdminCookie } from "./policy/admin-cookie";
export {
  customerCookieName,
  clearCustomerCookie,
  serializeCustomerCookie,
} from "./policy/customer-cookie";
export { isSameOriginMutation } from "./policy/same-origin";
export {
  AuthorizationGuardError,
  dashboardPermissionForPath,
  requireAdminActor,
  requireCustomerActor,
  requireCustomerOwnership,
  requireDashboardActor,
} from "./policy/guards";
export {
  ActorSessionRejectedError,
  getActorActiveSessions,
  revokeActorSessionById,
  revokeAllOtherActorSessions,
  type SessionPrincipal,
} from "./service/actor-sessions";
export {
  requestCustomerPasswordReset,
  resetCustomerPassword,
  PasswordResetRejectedError,
  PASSWORD_RESET_LIFETIME_MS,
} from "./service/customer-password-reset";
export { resetSmsEnabled, sendResetSms } from "./service/reset-sms";
export {
  changeCurrentCustomerPassword,
  CustomerPasswordChangeRejectedError,
  type CustomerPasswordChangeInput,
} from "./service/customer-password-change";
export {
  limitPasswordResetRequest,
  limitPasswordResetSubmission,
} from "./service/password-reset-limit";
export { limitSignupIdentity, limitSignupIp } from "./service/signup-limit";
export {
  CustomerLoginRejectedError,
  loginCustomer,
  logoutCustomer,
  resolveCustomerActor,
  type CustomerLoginInput,
  type CustomerLoginResult,
} from "./service/customer-session";
export {
  AdminLoginRejectedError,
  loginAdmin,
  logoutAdmin,
  resolveAdminActor,
  type AdminLoginInput,
  type AdminLoginResult,
} from "./service/admin-session";
