import "server-only";

import type { ApplicationLogger } from "@/server/observability/types";
import { isValidCustomerMobile, normalizeCustomerMobile } from "@/server/modules/customers";

import { TRANSACTION_MAX_AMOUNT_CENTS } from "../model/transaction";
import type { TransactionTransitionInput } from "../policy/transaction-state-machine";
import { FakePaymentProvider } from "./fake-payment-provider";
import {
  PaymentProviderError,
  type PaymentInitiation,
  type PaymentProvider,
  type ProviderCancellation,
  type ProviderPaymentStatus,
  type ProviderRefund,
  type ProviderWebhookEnvelope,
  type VerifiedProviderWebhook,
} from "./payment-provider";

const MAX_TIMEOUT_MS = 15_000;
const MIN_TIMEOUT_MS = 10;
const MAX_RETRIES = 2;
const SAFE_KEY = /^[A-Za-z0-9._:-]{8,128}$/u;
const PORTUGUESE_MOBILE = /^\+3519\d{8}$/u;

type SandboxTransport = Pick<
  PaymentProvider,
  "initiate" | "fetchStatus" | "cancel" | "verifyWebhook" | "mapEvent"
>;

export class MbWaySandboxError extends Error {
  constructor(readonly code: "outcome-unknown" | "transport-unavailable") {
    super(
      code === "outcome-unknown"
        ? "MB Way sandbox outcome is unknown; reconcile before attempting a new payment."
        : "MB Way sandbox is temporarily unavailable.",
    );
    this.name = "MbWaySandboxError";
  }
}

class SandboxTimeoutError extends Error {
  constructor() {
    super("MB Way sandbox request timed out.");
  }
}

/** The simulator transport may report a retryable pre-response connection fault. */
export class SandboxTransportError extends Error {
  constructor() {
    super("MB Way sandbox transport failed before a response was received.");
    this.name = "SandboxTransportError";
  }
}

export type MbWaySandboxOptions = {
  transport: SandboxTransport;
  timeoutMs?: number;
  maxRetries?: number;
  logger?: Pick<ApplicationLogger, "info" | "warn">;
};

/** Local simulator adapter. A real acquirer requires a separate documented HTTP transport. */
export class MbWaySandboxProvider implements PaymentProvider {
  readonly id = "mbway-sandbox";
  readonly capabilities = Object.freeze({ cancel: true, refund: false, webhook: true });

  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(private readonly options: MbWaySandboxOptions) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("The local MB Way sandbox simulator cannot be used in production.");
    }
    const timeoutMs = options.timeoutMs ?? 3_000;
    const maxRetries = options.maxRetries ?? 1;
    if (
      !Number.isSafeInteger(timeoutMs) ||
      timeoutMs < MIN_TIMEOUT_MS ||
      timeoutMs > MAX_TIMEOUT_MS
    )
      throw new RangeError("Sandbox timeout must be between 10 and 15000 ms.");
    if (!Number.isSafeInteger(maxRetries) || maxRetries < 0 || maxRetries > MAX_RETRIES)
      throw new RangeError("Sandbox retries must be between 0 and 2.");
    this.timeoutMs = timeoutMs;
    this.maxRetries = maxRetries;
  }

  async initiate(input: PaymentInitiation): Promise<ProviderPaymentStatus> {
    const mobile = normalizeCustomerMobile(input.payerMobile ?? "");
    if (
      !PORTUGUESE_MOBILE.test(mobile) ||
      !isValidCustomerMobile(mobile) ||
      !SAFE_KEY.test(input.idempotencyKey) ||
      input.currency !== "EUR" ||
      !Number.isSafeInteger(input.amountCents) ||
      input.amountCents < 1 ||
      input.amountCents > TRANSACTION_MAX_AMOUNT_CENTS
    ) {
      throw new PaymentProviderError("invalid-request", "Invalid MB Way sandbox payment input.");
    }
    const status = await this.withRetry("initiate", true, () =>
      this.options.transport.initiate({ ...input, payerMobile: mobile }),
    );
    if (
      status.status !== "pending" ||
      status.currency !== "EUR" ||
      status.amounts.requestedCents !== input.amountCents ||
      status.amounts.authorizedCents !== 0 ||
      status.amounts.capturedCents !== 0 ||
      status.amounts.refundedCents !== 0
    ) {
      throw new MbWaySandboxError("outcome-unknown");
    }
    return status;
  }

  async fetchStatus(providerPaymentId: string): Promise<ProviderPaymentStatus> {
    if (!providerPaymentId || providerPaymentId.length > 128)
      throw new PaymentProviderError("invalid-request", "Invalid provider payment reference.");
    return this.withRetry("fetch-status", false, () =>
      this.options.transport.fetchStatus(providerPaymentId),
    );
  }

  async cancel(input: ProviderCancellation): Promise<ProviderPaymentStatus> {
    if (!SAFE_KEY.test(input.idempotencyKey))
      throw new PaymentProviderError("invalid-request", "Invalid cancellation key.");
    return this.withRetry("cancel", true, () => this.options.transport.cancel(input));
  }

  async refund(input: ProviderRefund): Promise<ProviderPaymentStatus> {
    void input;
    throw new PaymentProviderError(
      "unsupported",
      "MB Way sandbox refunds require manual handling.",
    );
  }

  async verifyWebhook(envelope: ProviderWebhookEnvelope): Promise<VerifiedProviderWebhook | null> {
    return this.options.transport.verifyWebhook(envelope);
  }

  mapEvent(webhook: VerifiedProviderWebhook): TransactionTransitionInput {
    return this.options.transport.mapEvent(webhook);
  }

  private async withRetry<T>(
    operation: "initiate" | "fetch-status" | "cancel",
    sideEffecting: boolean,
    execute: () => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        const result = await this.withTimeout(execute());
        this.options.logger?.info({
          action: `payment.sandbox.${operation}`,
          message: "MB Way sandbox operation completed.",
          context: { operation, outcome: "success", attempt: attempt + 1 },
        });
        return result;
      } catch (error) {
        if (error instanceof PaymentProviderError) throw error;
        const retry =
          attempt < this.maxRetries &&
          (error instanceof SandboxTimeoutError || error instanceof SandboxTransportError);
        this.options.logger?.warn({
          action: `payment.sandbox.${operation}`,
          message: "MB Way sandbox operation has an uncertain transport outcome.",
          context: { operation, outcome: retry ? "retry" : "unknown", attempt: attempt + 1 },
        });
        if (!retry)
          throw new MbWaySandboxError(sideEffecting ? "outcome-unknown" : "transport-unavailable");
      }
    }
    throw new MbWaySandboxError(sideEffecting ? "outcome-unknown" : "transport-unavailable");
  }

  private async withTimeout<T>(operation: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        operation,
        new Promise<T>((_resolve, reject) => {
          timer = setTimeout(() => reject(new SandboxTimeoutError()), this.timeoutMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

export function createLocalMbWaySandboxProvider(
  webhookSecret: string,
  options: Omit<MbWaySandboxOptions, "transport"> = {},
): MbWaySandboxProvider {
  return new MbWaySandboxProvider({
    ...options,
    transport: new FakePaymentProvider(webhookSecret, () => new Date(), {
      cancel: true,
      refund: false,
      webhook: true,
    }),
  });
}
