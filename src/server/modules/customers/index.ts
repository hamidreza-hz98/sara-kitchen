/** Public entry point for customer identity and profile management. */
export const MODULE_NAME = "customers" as const;
export { hashCustomerPassword, verifyCustomerPasswordForLogin } from "./service/password";
export {
  normalizeCustomerEmail,
  normalizeCustomerMobile,
  normalizeCustomerName,
} from "./validation/customer-identity";
