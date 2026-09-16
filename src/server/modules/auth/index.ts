/** Public entry point for authentication use cases. */
export const MODULE_NAME = "auth" as const;
export { adminCookieName, clearAdminCookie, serializeAdminCookie } from "./policy/admin-cookie";
export { isSameOriginMutation } from "./policy/same-origin";
export {
  AdminLoginRejectedError,
  loginAdmin,
  logoutAdmin,
  resolveAdminActor,
  type AdminLoginInput,
  type AdminLoginResult,
} from "./service/admin-session";
