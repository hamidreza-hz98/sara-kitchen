/** Public entry point for authentication use cases. */
export const MODULE_NAME = "auth" as const;
export { adminCookieName, clearAdminCookie, serializeAdminCookie } from "./policy/admin-cookie";
export { isSameOriginMutation } from "./policy/same-origin";
export { limitSignupIdentity, limitSignupIp } from "./service/signup-limit";
export {
  AdminLoginRejectedError,
  loginAdmin,
  logoutAdmin,
  resolveAdminActor,
  type AdminLoginInput,
  type AdminLoginResult,
} from "./service/admin-session";
