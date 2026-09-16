/** Public entry point for payment and financial transaction use cases. */
export const MODULE_NAME = "transactions" as const;

export {
  fingerprintRequest,
  runIdempotentOperation,
  type IdempotencyInput,
  type IdempotencyOutcome,
  type JsonValue,
} from "./service/idempotency";
