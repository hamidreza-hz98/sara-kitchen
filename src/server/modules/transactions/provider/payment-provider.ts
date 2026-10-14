import type { TransactionAmounts, TransactionStatus } from "../model/transaction";
import type { TransactionTransitionInput } from "../policy/transaction-state-machine";

/** Provider calls are external effects and must run outside a MongoDB transaction. */
export interface PaymentProvider {
  readonly capabilities: Readonly<PaymentProviderCapabilities>;
  readonly id: string;

  initiate(input: PaymentInitiation): Promise<ProviderPaymentStatus>;
  fetchStatus(providerPaymentId: string): Promise<ProviderPaymentStatus>;
  cancel(input: ProviderCancellation): Promise<ProviderPaymentStatus>;
  refund(input: ProviderRefund): Promise<ProviderPaymentStatus>;
  verifyWebhook(envelope: ProviderWebhookEnvelope): Promise<VerifiedProviderWebhook | null>;
  mapEvent(webhook: VerifiedProviderWebhook): TransactionTransitionInput;
}

export type PaymentProviderCapabilities = {
  readonly cancel: boolean;
  readonly refund: boolean;
  readonly webhook: boolean;
};

export type PaymentInitiation = {
  transactionId: string;
  orderId: string;
  amountCents: number;
  currency: "EUR";
  idempotencyKey: string;
  /** Transient payment detail; adapters must never log, persist, or return it. */
  payerMobile?: string;
};

export type ProviderCancellation = {
  providerPaymentId: string;
  idempotencyKey: string;
};

export type ProviderRefund = {
  providerPaymentId: string;
  amountCents: number;
  idempotencyKey: string;
};

export type ProviderPaymentStatus = {
  providerPaymentId: string;
  providerRequestId: string;
  currency: "EUR";
  status: TransactionStatus;
  amounts: TransactionAmounts;
  observedAt: Date;
};

export type ProviderWebhookEnvelope = {
  rawBody: string;
  signature: string | null;
  timestamp: string | null;
  receivedAt: Date;
};

export type VerifiedProviderWebhook = {
  providerPaymentId: string;
  providerEventId: string;
  code: string;
  amountCents: number | null;
  occurredAt: Date;
  responseCode: string | null;
};

export class PaymentProviderError extends Error {
  constructor(
    readonly code: "unsupported" | "not-found" | "conflict" | "invalid-request",
    message: string,
  ) {
    super(message);
    this.name = "PaymentProviderError";
  }
}
