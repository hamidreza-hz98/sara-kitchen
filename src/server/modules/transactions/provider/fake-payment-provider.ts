import "server-only";

import { createHmac } from "node:crypto";

import { z } from "zod";

import type { TransactionEvent } from "../model/transaction";
import { verifyMbWayWebhookSignature } from "../policy/mbway-webhook-signature";
import {
  mapMbWaySandboxEvent,
  planTransactionTransition,
  type TransactionEventKind,
  type TransactionSnapshot,
  type TransactionTransitionInput,
} from "../policy/transaction-state-machine";
import {
  PaymentProviderError,
  type PaymentInitiation,
  type PaymentProvider,
  type PaymentProviderCapabilities,
  type ProviderCancellation,
  type ProviderPaymentStatus,
  type ProviderRefund,
  type ProviderWebhookEnvelope,
  type VerifiedProviderWebhook,
} from "./payment-provider";

const safeRef = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/u);
const safeCode = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Z0-9_:-]+$/u);
const webhookSchema = z.strictObject({
  paymentId: safeRef,
  eventId: safeRef,
  code: z.enum(["PENDING", "AUTHORIZED", "PAID", "FAILED", "CANCELLED", "EXPIRED", "REFUNDED"]),
  amountCents: z.number().int().nonnegative().safe().nullable(),
  responseCode: safeCode.nullable(),
  occurredAt: z.iso.datetime(),
});

type FakePayment = {
  transactionId: string;
  orderId: string;
  requestId: string;
  snapshot: TransactionSnapshot;
};

/** Deterministic, in-memory contract fixture. It never makes network calls. */
export class FakePaymentProvider implements PaymentProvider {
  readonly id = "mbway-sandbox-fake";
  readonly capabilities: Readonly<PaymentProviderCapabilities>;

  private sequence = 0;
  private readonly payments = new Map<string, FakePayment>();
  private readonly initiationKeys = new Map<string, { fingerprint: string; paymentId: string }>();
  private readonly actionKeys = new Map<string, { fingerprint: string; paymentId: string }>();

  constructor(
    private readonly secret: string,
    private readonly now: () => Date = () => new Date("2026-10-14T12:00:00.000Z"),
    capabilities: PaymentProviderCapabilities = { cancel: true, refund: true, webhook: true },
  ) {
    if (secret.length < 32)
      throw new PaymentProviderError("invalid-request", "Fake webhook secret is too short.");
    this.capabilities = Object.freeze({ ...capabilities });
  }

  async initiate(input: PaymentInitiation): Promise<ProviderPaymentStatus> {
    if (
      !safeRef.safeParse(input.transactionId).success ||
      !safeRef.safeParse(input.orderId).success ||
      !safeRef.safeParse(input.idempotencyKey).success ||
      input.currency !== "EUR" ||
      !Number.isSafeInteger(input.amountCents) ||
      input.amountCents < 0
    ) {
      throw new PaymentProviderError("invalid-request", "Invalid initiation request.");
    }
    const fingerprint = JSON.stringify([
      input.transactionId,
      input.orderId,
      input.currency,
      input.amountCents,
    ]);
    const existing = this.initiationKeys.get(input.idempotencyKey);
    if (existing) {
      if (existing.fingerprint !== fingerprint)
        throw new PaymentProviderError(
          "conflict",
          "Idempotency key was reused for a different payment.",
        );
      return this.fetchStatus(existing.paymentId);
    }
    const paymentId = `fake_payment_${++this.sequence}`;
    const requestId = `fake_request_${this.sequence}`;
    const occurredAt = this.now();
    const created: TransactionEvent = {
      eventKey: `fake_created_${this.sequence}`,
      source: "system",
      status: "created",
      amountCents: null,
      responseCode: null,
      providerEventId: null,
      occurredAt,
      recordedAt: occurredAt,
    };
    const snapshot: TransactionSnapshot = {
      requestedCents: input.amountCents,
      amounts: {
        requestedCents: input.amountCents,
        authorizedCents: 0,
        capturedCents: 0,
        refundedCents: 0,
      },
      status: "created",
      events: [created],
    };
    const pending = planTransactionTransition(snapshot, {
      kind: "payment.pending",
      eventKey: `fake_pending_${this.sequence}`,
      source: "provider",
      occurredAt,
      recordedAt: occurredAt,
    });
    this.payments.set(paymentId, {
      transactionId: input.transactionId,
      orderId: input.orderId,
      requestId,
      snapshot: {
        ...snapshot,
        status: pending.status,
        amounts: pending.amounts,
        events: [...snapshot.events, pending.event],
      },
    });
    this.initiationKeys.set(input.idempotencyKey, { fingerprint, paymentId });
    return this.fetchStatus(paymentId);
  }

  async fetchStatus(providerPaymentId: string): Promise<ProviderPaymentStatus> {
    const payment = this.payment(providerPaymentId);
    return {
      providerPaymentId,
      providerRequestId: payment.requestId,
      currency: "EUR",
      status: payment.snapshot.status,
      amounts: { ...payment.snapshot.amounts },
      observedAt: this.now(),
    };
  }

  async cancel(input: ProviderCancellation): Promise<ProviderPaymentStatus> {
    if (!this.capabilities.cancel)
      throw new PaymentProviderError("unsupported", "Cancellation is unsupported.");
    return this.action(input.providerPaymentId, input.idempotencyKey, "CANCELLED", null);
  }

  async refund(input: ProviderRefund): Promise<ProviderPaymentStatus> {
    if (!this.capabilities.refund)
      throw new PaymentProviderError("unsupported", "Automated refunds are unsupported.");
    return this.action(
      input.providerPaymentId,
      input.idempotencyKey,
      "REFUNDED",
      input.amountCents,
    );
  }

  async verifyWebhook(envelope: ProviderWebhookEnvelope): Promise<VerifiedProviderWebhook | null> {
    if (
      !this.capabilities.webhook ||
      envelope.rawBody.length > 4096 ||
      !verifyMbWayWebhookSignature({
        rawBody: envelope.rawBody,
        signature: envelope.signature,
        timestamp: envelope.timestamp,
        secret: this.secret,
        now: envelope.receivedAt,
      })
    )
      return null;
    try {
      const parsed = webhookSchema.safeParse(JSON.parse(envelope.rawBody) as unknown);
      if (!parsed.success || !this.payments.has(parsed.data.paymentId)) return null;
      return {
        providerPaymentId: parsed.data.paymentId,
        providerEventId: parsed.data.eventId,
        code: parsed.data.code,
        amountCents: parsed.data.amountCents,
        responseCode: parsed.data.responseCode,
        occurredAt: new Date(parsed.data.occurredAt),
      };
    } catch {
      return null;
    }
  }

  mapEvent(webhook: VerifiedProviderWebhook): TransactionTransitionInput {
    this.payment(webhook.providerPaymentId);
    const kind = mapMbWaySandboxEvent(webhook.code);
    return {
      kind,
      eventKey: `provider:${webhook.providerEventId}`,
      providerEventId: webhook.providerEventId,
      amountCents: webhook.amountCents,
      responseCode: webhook.responseCode,
      occurredAt: webhook.occurredAt,
      source: "provider",
    };
  }

  /** Test-only provider event injection. Returns a signed fixture, not a persisted webhook. */
  simulateEvent(
    providerPaymentId: string,
    code: "AUTHORIZED" | "PAID" | "FAILED" | "EXPIRED" | "REFUNDED",
    amountCents: number | null,
    providerEventId: string,
  ): ProviderWebhookEnvelope {
    const payment = this.payment(providerPaymentId);
    const kind: TransactionEventKind = mapMbWaySandboxEvent(code);
    const occurredAt = this.now();
    const transition = planTransactionTransition(payment.snapshot, {
      kind,
      eventKey: `provider:${providerEventId}`,
      providerEventId,
      amountCents,
      occurredAt,
      recordedAt: occurredAt,
      source: "provider",
    });
    payment.snapshot = {
      ...payment.snapshot,
      status: transition.status,
      amounts: transition.amounts,
      events: [...payment.snapshot.events, transition.event],
    };
    return this.signWebhook({
      paymentId: providerPaymentId,
      eventId: providerEventId,
      code,
      amountCents,
      responseCode: code,
      occurredAt: occurredAt.toISOString(),
    });
  }

  private async action(
    providerPaymentId: string,
    idempotencyKey: string,
    code: "CANCELLED" | "REFUNDED",
    amountCents: number | null,
  ): Promise<ProviderPaymentStatus> {
    if (!safeRef.safeParse(idempotencyKey).success)
      throw new PaymentProviderError("invalid-request", "Invalid action key.");
    const fingerprint = JSON.stringify([providerPaymentId, code, amountCents]);
    const existing = this.actionKeys.get(idempotencyKey);
    if (existing) {
      if (existing.fingerprint !== fingerprint)
        throw new PaymentProviderError(
          "conflict",
          "Idempotency key was reused for a different action.",
        );
      return this.fetchStatus(existing.paymentId);
    }
    const payment = this.payment(providerPaymentId);
    const occurredAt = this.now();
    const transition = planTransactionTransition(payment.snapshot, {
      kind: mapMbWaySandboxEvent(code),
      eventKey: `fake_action_${++this.sequence}`,
      amountCents,
      occurredAt,
      recordedAt: occurredAt,
      source: "provider",
    });
    payment.snapshot = {
      ...payment.snapshot,
      status: transition.status,
      amounts: transition.amounts,
      events: [...payment.snapshot.events, transition.event],
    };
    this.actionKeys.set(idempotencyKey, { fingerprint, paymentId: providerPaymentId });
    return this.fetchStatus(providerPaymentId);
  }

  private signWebhook(payload: z.infer<typeof webhookSchema>): ProviderWebhookEnvelope {
    const rawBody = JSON.stringify(payload);
    const receivedAt = this.now();
    const timestamp = String(Math.floor(receivedAt.getTime() / 1000));
    const signature = `sha256=${createHmac("sha256", this.secret).update(`${timestamp}.${rawBody}`).digest("hex")}`;
    return { rawBody, signature, timestamp, receivedAt };
  }

  private payment(providerPaymentId: string): FakePayment {
    const payment = this.payments.get(providerPaymentId);
    if (!payment) throw new PaymentProviderError("not-found", "Provider payment was not found.");
    return payment;
  }
}
