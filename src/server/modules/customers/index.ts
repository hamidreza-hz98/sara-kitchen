/** Public entry point for customer identity and profile management. */
export const MODULE_NAME = "customers" as const;
export { hashCustomerPassword, verifyCustomerPasswordForLogin } from "./service/password";
export { registerCustomer } from "./service/signup";
export {
  findCustomerForLogin,
  getActiveCustomerIdentity,
  type ActiveCustomerIdentity,
  type CustomerLoginIdentity,
} from "./service/customer-login";
export { customerSignupSchema } from "./validation/signup";
export {
  findCustomerForReset,
  replaceCustomerPasswordAfterReset,
  type ResetCustomerIdentity,
} from "./service/customer-reset";
export { isStrongSignupPassword } from "./validation/signup";
export {
  normalizeCustomerEmail,
  normalizeCustomerMobile,
  normalizeCustomerName,
} from "./validation/customer-identity";
