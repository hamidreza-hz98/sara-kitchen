/** Public entry point for authentication use cases. */
export const MODULE_NAME = "auth" as const;
export { adminCookieName, clearAdminCookie, serializeAdminCookie } from "./policy/admin-cookie";
export {
  customerCookieName,
  clearCustomerCookie,
  serializeCustomerCookie,
} from "./policy/customer-cookie";
export { isSameOriginMutation } from "./policy/same-origin";
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
