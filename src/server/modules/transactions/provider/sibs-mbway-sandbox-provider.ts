import "server-only";

import { createDecipheriv } from "node:crypto";

import { MBWAY_SANDBOX_API_URL } from "@/constants/payment";
import { isValidCustomerMobile, normalizeCustomerMobile } from "@/server/modules/customers";

import { TRANSACTION_MAX_AMOUNT_CENTS, type TransactionStatus } from "../model/transaction";
import { mapMbWaySandboxEvent } from "../policy/transaction-state-machine";
import type { ServerEnvironment } from "@/validations/env/server-schema";
import { MbWaySandboxError } from "./mbway-sandbox-provider";
import {
  PaymentProviderError,
  type PaymentInitiation,
  type PaymentProvider,
  type ProviderPaymentStatus,
  type ProviderWebhookEnvelope,
  type VerifiedProviderWebhook,
} from "./payment-provider";

const MAX_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 64 * 1024;
const SAFE_REFERENCE = /^[A-Za-z0-9._:-]{1,128}$/u;
const SAFE_KEY = /^[A-Za-z0-9._:-]{8,128}$/u;
const PORTUGUESE_MOBILE = /^\+3519\d{8}$/u;
const PAYMENT_STATUSES = [
  "Pending",
  "In Processing",
  "Success",
  "Declined",
  "Error",
  "Timeout",
  "Cancelled",
  "Canceled",
] as const;

type PaymentStatusLabel = (typeof PAYMENT_STATUSES)[number];

type SibsMbWaySandboxConfiguration = Readonly<{
  terminalId: string;
  clientId: string;
  authToken: string;
  webhookSecret: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
}>;

type SibsAmount = Readonly<{ value: number; currency: "EUR" }>;

type SibsPaymentResponse = Readonly<{
  returnStatus: Readonly<{ statusCode: string }>;
  transactionID: string;
  paymentStatus: PaymentStatusLabel;
  paymentMethod?: string;
  paymentType?: string;
  amount: SibsAmount;
  transactionDateTime?: string;
}>;

type SibsCheckoutResponse = Readonly<{
  returnStatus: Readonly<{ statusCode: string }>;
  transactionID: string;
  transactionSignature: string;
}>;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseSafeBase64(value: string, expectedBytes?: number): Buffer | null {
  const normalized = value.replace(/\s/gu, "");
  if (
    !normalized ||
    normalized.length > MAX_RESPONSE_BYTES * 2 ||
    !/^[A-Za-z0-9+/]+={0,2}$/u.test(normalized)
  )
    return null;
  const decoded = Buffer.from(normalized, "base64");
  if (
    decoded.toString("base64") !== normalized ||
    (expectedBytes && decoded.length !== expectedBytes)
  )
    return null;
  return decoded;
}

function safeReference(value: unknown): value is string {
  return typeof value === "string" && SAFE_REFERENCE.test(value);
}

function toCents(amount: SibsAmount): number {
  const cents = Math.round(amount.value * 100);
  if (
    amount.currency !== "EUR" ||
    !Number.isSafeInteger(cents) ||
    cents < 1 ||
    cents > TRANSACTION_MAX_AMOUNT_CENTS ||
    Math.abs(amount.value * 100 - cents) > 0.0001
  ) {
    throw new MbWaySandboxError("transport-unavailable");
  }
  return cents;
}

function transactionStatus(status: PaymentStatusLabel): TransactionStatus {
  switch (status) {
    case "Pending":
    case "In Processing":
      return "pending";
    case "Success":
      return "paid";
    case "Declined":
    case "Error":
      return "failed";
    case "Timeout":
      return "expired";
    case "Cancelled":
    case "Canceled":
      return "cancelled";
  }
}

function providerAmounts(status: TransactionStatus, requestedCents: number) {
  return {
    requestedCents,
    authorizedCents: 0,
    capturedCents: status === "paid" ? requestedCents : 0,
    refundedCents: 0,
  };
}

function parsePaymentResponse(value: unknown): SibsPaymentResponse {
  const source = record(value);
  const returnStatus = record(source?.returnStatus);
  const amount = record(source?.amount);
  const paymentStatus = source?.paymentStatus;
  if (
    !source ||
    typeof returnStatus?.statusCode !== "string" ||
    !safeReference(source.transactionID) ||
    typeof paymentStatus !== "string" ||
    !PAYMENT_STATUSES.includes(paymentStatus as PaymentStatusLabel) ||
    typeof amount?.value !== "number" ||
    !Number.isFinite(amount.value) ||
    amount.currency !== "EUR" ||
    (source.paymentMethod !== undefined && source.paymentMethod !== "MBWAY") ||
    (source.paymentType !== undefined && source.paymentType !== "PURS")
  ) {
    throw new MbWaySandboxError("transport-unavailable");
  }
  return {
    returnStatus: { statusCode: returnStatus.statusCode },
    transactionID: source.transactionID,
    paymentStatus: paymentStatus as PaymentStatusLabel,
    ...(source.paymentMethod === undefined
      ? {}
      : { paymentMethod: source.paymentMethod as string }),
    ...(source.paymentType === undefined ? {} : { paymentType: source.paymentType as string }),
    amount: { value: amount.value, currency: "EUR" },
    ...(typeof source.transactionDateTime === "string"
      ? { transactionDateTime: source.transactionDateTime }
      : {}),
  };
}

function parseCheckoutResponse(value: unknown): SibsCheckoutResponse {
  const source = record(value);
  const returnStatus = record(source?.returnStatus);
  const signature = source?.transactionSignature;
  if (
    !source ||
    typeof returnStatus?.statusCode !== "string" ||
    !safeReference(source.transactionID) ||
    typeof signature !== "string" ||
    signature.length < 1 ||
    signature.length > 2048 ||
    !/^[\x21-\x7E]+$/u.test(signature)
  ) {
    throw new MbWaySandboxError("outcome-unknown");
  }
  return {
    returnStatus: { statusCode: returnStatus.statusCode },
    transactionID: source.transactionID,
    transactionSignature: signature,
  };
}

function parseDate(value: string | undefined, fallback: Date): Date {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : fallback;
}

function normalizedStatus(
  response: SibsPaymentResponse,
  providerRequestId: string,
): ProviderPaymentStatus {
  if (response.returnStatus.statusCode !== "000") {
    throw new MbWaySandboxError("transport-unavailable");
  }
  const status = transactionStatus(response.paymentStatus);
  const requestedCents = toCents(response.amount);
  return {
    providerPaymentId: response.transactionID,
    providerRequestId,
    currency: "EUR",
    status,
    amounts: providerAmounts(status, requestedCents),
    observedAt: parseDate(response.transactionDateTime, new Date()),
  };
}

/** SIBS SPG adapter pinned to the official sandbox host for every deployment environment. */
export class SibsMbWaySandboxProvider implements PaymentProvider {
  readonly id = "mbway-sandbox";
  readonly capabilities = Object.freeze({ cancel: false, refund: false, webhook: true });

  private readonly terminalId: number;
  private readonly timeoutMs: number;
  private readonly fetcher: typeof fetch;
  private readonly webhookKey: Buffer;

  constructor(private readonly configuration: SibsMbWaySandboxConfiguration) {
    if (!/^\d{1,12}$/u.test(configuration.terminalId)) {
      throw new Error("MBWAY_TERMINAL_ID must be a numeric SIBS sandbox terminal ID.");
    }
    const terminalId = Number(configuration.terminalId);
    if (!Number.isSafeInteger(terminalId)) throw new Error("Invalid SIBS sandbox terminal ID.");
    const webhookKey = parseSafeBase64(configuration.webhookSecret, 32);
    if (!webhookKey) throw new Error("MBWAY_WEBHOOK_SECRET must be a base64 encoded 32-byte key.");
    const timeoutMs = configuration.timeoutMs ?? 8_000;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 500 || timeoutMs > MAX_TIMEOUT_MS) {
      throw new RangeError("SIBS sandbox timeout must be between 500 and 15000 ms.");
    }
    if (!configuration.clientId.trim() || !configuration.authToken.trim()) {
      throw new Error("SIBS sandbox client and authorization credentials are required.");
    }
    this.terminalId = terminalId;
    this.timeoutMs = timeoutMs;
    this.fetcher = configuration.fetcher ?? fetch;
    this.webhookKey = webhookKey;
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
      throw new PaymentProviderError("invalid-request", "Invalid MB WAY sandbox payment input.");
    }

    const session = parseCheckoutResponse(
      await this.request("/payments", {
        method: "POST",
        authorization: `Bearer ${this.configuration.authToken}`,
        body: {
          merchant: {
            terminalId: this.terminalId,
            channel: "web",
            merchantTransactionId: input.idempotencyKey,
          },
          transaction: {
            transactionTimestamp: new Date().toISOString(),
            description: "Sara Kitchen order",
            moto: false,
            paymentType: "PURS",
            amount: { value: Number((input.amountCents / 100).toFixed(2)), currency: "EUR" },
            paymentMethod: ["MBWAY"],
          },
        },
        sideEffecting: true,
      }),
    );
    if (input.onSessionCreated) {
      await input.onSessionCreated({
        providerPaymentId: session.transactionID,
        providerRequestId: input.idempotencyKey,
      });
    }

    await this.request(`/payments/${encodeURIComponent(session.transactionID)}/mbway-id/purchase`, {
      method: "POST",
      authorization: `Digest ${session.transactionSignature}`,
      body: { customerPhone: `351#${mobile.slice(4)}`, inApp: true },
      sideEffecting: true,
    });

    return {
      providerPaymentId: session.transactionID,
      providerRequestId: input.idempotencyKey,
      currency: "EUR",
      status: "pending",
      amounts: {
        requestedCents: input.amountCents,
        authorizedCents: 0,
        capturedCents: 0,
        refundedCents: 0,
      },
      observedAt: new Date(),
    };
  }

  async fetchStatus(
    providerPaymentId: string,
    providerRequestId?: string,
  ): Promise<ProviderPaymentStatus> {
    if (
      !safeReference(providerPaymentId) ||
      !providerRequestId ||
      !SAFE_KEY.test(providerRequestId)
    ) {
      throw new PaymentProviderError("invalid-request", "Invalid SIBS sandbox payment reference.");
    }
    const response = parsePaymentResponse(
      await this.request(`/payments/${encodeURIComponent(providerPaymentId)}/status`, {
        method: "GET",
        authorization: `Bearer ${this.configuration.authToken}`,
        sideEffecting: false,
      }),
    );
    if (response.transactionID !== providerPaymentId) {
      throw new MbWaySandboxError("transport-unavailable");
    }
    return normalizedStatus(response, providerRequestId);
  }

  async cancel(): Promise<ProviderPaymentStatus> {
    throw new PaymentProviderError("unsupported", "SIBS MB WAY cancellation is not enabled.");
  }

  async refund(): Promise<ProviderPaymentStatus> {
    throw new PaymentProviderError("unsupported", "SIBS MB WAY refunds require manual handling.");
  }

  async verifyWebhook(envelope: ProviderWebhookEnvelope): Promise<VerifiedProviderWebhook | null> {
    const iv = envelope.initializationVector
      ? parseSafeBase64(envelope.initializationVector, 12)
      : null;
    const tag = envelope.authenticationTag ? parseSafeBase64(envelope.authenticationTag, 16) : null;
    const ciphertext = parseSafeBase64(envelope.rawBody);
    if (!iv || !tag || !ciphertext || ciphertext.length < 1) return null;

    try {
      const decipher = createDecipheriv("aes-256-gcm", this.webhookKey, iv);
      decipher.setAuthTag(tag);
      const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
        "utf8",
      );
      const payload = record(JSON.parse(plaintext) as unknown);
      const returnStatus = record(payload?.returnStatus);
      const amount = record(payload?.amount);
      const code = this.webhookCode(payload?.paymentStatus);
      if (
        !payload ||
        returnStatus?.statusCode !== "000" ||
        !safeReference(payload.transactionID) ||
        !safeReference(payload.notificationID) ||
        (payload.paymentMethod !== undefined && payload.paymentMethod !== "MBWAY") ||
        (payload.paymentType !== undefined && payload.paymentType !== "PURS") ||
        !amount ||
        typeof amount.value !== "number" ||
        !Number.isFinite(amount.value) ||
        amount.currency !== "EUR"
      ) {
        return null;
      }
      const paymentStatus = payload.paymentStatus as PaymentStatusLabel;
      const amountCents =
        paymentStatus === "Success" ? toCents({ value: amount.value, currency: "EUR" }) : null;
      return {
        providerPaymentId: payload.transactionID,
        providerEventId: payload.notificationID,
        code,
        amountCents,
        occurredAt: parseDate(
          typeof payload.transactionDateTime === "string" ? payload.transactionDateTime : undefined,
          envelope.receivedAt,
        ),
        responseCode: returnStatus.statusCode,
      };
    } catch {
      return null;
    }
  }

  mapEvent(webhook: VerifiedProviderWebhook) {
    return {
      kind: mapMbWaySandboxEvent(webhook.code),
      amountCents: webhook.amountCents,
      occurredAt: webhook.occurredAt,
      responseCode: webhook.responseCode,
      source: "provider" as const,
      eventKey: `provider:${webhook.providerEventId}`,
      providerEventId: webhook.providerEventId,
    };
  }

  private webhookCode(value: unknown): string {
    switch (value) {
      case "Pending":
      case "In Processing":
        return "PENDING";
      case "Success":
        return "PAID";
      case "Declined":
      case "Error":
        return "FAILED";
      case "Timeout":
        return "EXPIRED";
      case "Cancelled":
      case "Canceled":
        return "CANCELLED";
      default:
        throw new Error("Unsupported SIBS payment status.");
    }
  }

  private async request(
    path: string,
    input: {
      method: "GET" | "POST";
      authorization: string;
      body?: Record<string, unknown>;
      sideEffecting: boolean;
    },
  ): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetcher(`${MBWAY_SANDBOX_API_URL}${path}`, {
        method: input.method,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-IBM-Client-Id": this.configuration.clientId,
          Authorization: input.authorization,
        },
        ...(input.body ? { body: JSON.stringify(input.body) } : {}),
        signal: controller.signal,
        cache: "no-store",
      });
      const raw = await this.readLimited(response);
      let body: unknown;
      try {
        body = JSON.parse(raw) as unknown;
      } catch {
        throw new MbWaySandboxError(
          input.sideEffecting ? "outcome-unknown" : "transport-unavailable",
        );
      }
      const returnStatus = record(record(body)?.returnStatus);
      if (!response.ok || returnStatus?.statusCode !== "000") {
        throw new MbWaySandboxError(
          input.sideEffecting ? "outcome-unknown" : "transport-unavailable",
        );
      }
      return body;
    } catch (error) {
      if (error instanceof MbWaySandboxError || error instanceof PaymentProviderError) throw error;
      throw new MbWaySandboxError(
        input.sideEffecting ? "outcome-unknown" : "transport-unavailable",
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private async readLimited(response: Response): Promise<string> {
    if (!response.body) return "";
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_RESPONSE_BYTES) {
          await reader.cancel();
          throw new MbWaySandboxError("transport-unavailable");
        }
        chunks.push(value);
      }
      return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
    } finally {
      reader.releaseLock();
    }
  }
}

export function createSibsMbWaySandboxProvider(
  configuration: SibsMbWaySandboxConfiguration,
): SibsMbWaySandboxProvider {
  return new SibsMbWaySandboxProvider(configuration);
}

export function createConfiguredSibsMbWaySandboxProvider(
  environment: Pick<
    ServerEnvironment,
    | "MBWAY_ENABLED"
    | "MBWAY_API_URL"
    | "MBWAY_TERMINAL_ID"
    | "MBWAY_CLIENT_ID"
    | "MBWAY_AUTH_TOKEN"
    | "MBWAY_WEBHOOK_SECRET"
  >,
): SibsMbWaySandboxProvider {
  if (
    !environment.MBWAY_ENABLED ||
    environment.MBWAY_API_URL !== MBWAY_SANDBOX_API_URL ||
    !environment.MBWAY_TERMINAL_ID ||
    !environment.MBWAY_CLIENT_ID ||
    !environment.MBWAY_AUTH_TOKEN ||
    !environment.MBWAY_WEBHOOK_SECRET
  ) {
    throw new PaymentProviderError("unsupported", "SIBS MB WAY sandbox is not configured.");
  }
  return createSibsMbWaySandboxProvider({
    terminalId: environment.MBWAY_TERMINAL_ID,
    clientId: environment.MBWAY_CLIENT_ID,
    authToken: environment.MBWAY_AUTH_TOKEN,
    webhookSecret: environment.MBWAY_WEBHOOK_SECRET,
  });
}
