/** Public entry point for payment and financial transaction use cases. */
export const MODULE_NAME = "transactions" as const;

export {
  TRANSACTION_CURRENCY,
  TRANSACTION_EVENT_SOURCES,
  TRANSACTION_METHODS,
  TRANSACTION_PROVIDERS,
  TRANSACTION_STATUSES,
  type TransactionMethod,
  type TransactionProvider,
  type TransactionStatus,
} from "./model/transaction";

export { verifyMbWayWebhookSignature } from "./policy/mbway-webhook-signature";

export {
  mapMbWaySandboxEvent,
  planTransactionTransition,
  replayTransactionHistory,
  TRANSACTION_TRANSITIONS,
  TransactionTransitionError,
  type TransactionEventKind,
  type TransactionSnapshot,
  type TransactionTransition,
  type TransactionTransitionInput,
} from "./policy/transaction-state-machine";

export {
  fingerprintRequest,
  runIdempotentOperation,
  type IdempotencyInput,
  type IdempotencyOutcome,
  type JsonValue,
} from "./service/idempotency";

export {
  PaymentProviderError,
  type PaymentProvider,
  type PaymentProviderCapabilities,
  type PaymentInitiation,
  type ProviderCancellation,
  type ProviderPaymentStatus,
  type ProviderRefund,
  type ProviderWebhookEnvelope,
  type VerifiedProviderWebhook,
} from "./provider/payment-provider";

export {
  createLocalMbWaySandboxProvider,
  MbWaySandboxError,
  MbWaySandboxProvider,
  SandboxTransportError,
  type MbWaySandboxOptions,
} from "./provider/mbway-sandbox-provider";

export {
  persistMbWaySandboxInitiation,
  type StoredMbWayInitiation,
} from "./service/mbway-sandbox-initiation";
