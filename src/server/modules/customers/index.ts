/** Public entry point for customer identity and profile management. */
export const MODULE_NAME = "customers" as const;
export { hashCustomerPassword } from "./service/password";
export {
  normalizeCustomerEmail,
  normalizeCustomerMobile,
  normalizeCustomerName,
} from "./validation/customer-identity";
