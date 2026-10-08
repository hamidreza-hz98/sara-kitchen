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
  changeCustomerPassword,
  type CustomerPasswordChangeOutcome,
} from "./service/customer-change-password";
export {
  isValidCustomerMobile,
  isValidCustomerName,
  normalizeCustomerEmail,
  normalizeCustomerMobile,
  normalizeCustomerName,
} from "./validation/customer-identity";
export { CUSTOMER_STATUSES, type CustomerStatus } from "./model/customer";
export {
  createCustomerRepository,
  CustomerRepositoryConflictError,
  type CustomerListOptions,
  type CustomerListResult,
  type CustomerProfileWrite,
  type CustomerRepository,
  type CustomerSnapshot,
  type CustomerWriteActor,
} from "./repository/customer";
export {
  createCustomerCrudServices,
  CustomerCrudError,
  type CustomerCrudAction,
  type CustomerCrudActor,
  type CustomerCrudAuditEvent,
  type CustomerCrudDependencies,
  type CustomerView,
} from "./service/customer-crud";
export { createCustomerAuditSink } from "./service/customer-audit";
export {
  customerEmptyMutationSchema,
  customerIdParametersSchema,
  customerListQuerySchema,
  customerProfileUpdateSchema,
  customerStatusSchema,
  type CustomerProfileUpdateInput,
} from "./validation/customer-request";
