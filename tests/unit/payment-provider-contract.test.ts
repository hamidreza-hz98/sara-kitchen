import { createHmac } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { FakePaymentProvider } from "@/server/modules/transactions/provider/fake-payment-provider";
import {
  PaymentProviderError,
  type PaymentProvider,
  type PaymentInitiation,
  type ProviderWebhookEnvelope,
} from "@/server/modules/transactions/provider/payment-provider";

const secret = "fake-provider-webhook-secret-for-tests-only";
const now = new Date("2026-10-14T12:00:00.000Z");
const initiate: PaymentInitiation = {
  transactionId: "transaction-1",
  orderId: "order-1",
  amountCents: 1_250,
  currency: "EUR",
  idempotencyKey: "initiate-1",
  payerMobile: "+351912345678",
};

function sign(rawBody: string): ProviderWebhookEnvelope {
  const timestamp = String(Math.floor(now.getTime() / 1000));
  return {
    rawBody,
    signature: `sha256=${createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex")}`,
    timestamp,
    receivedAt: now,
  };
}

function providerContract(makeProvider: () => PaymentProvider) {
  let provider: PaymentProvider;

  beforeEach(() => {
    provider = makeProvider();
  });

  it("initiates a EUR payment and retrieves a detached authoritative status", async () => {
    const started = await provider.initiate(initiate);
    expect(started).toMatchObject({
      currency: "EUR",
      status: "pending",
      amounts: { requestedCents: 1_250, capturedCents: 0, refundedCents: 0 },
    });
    expect(started.providerPaymentId).toBeTruthy();
    expect(started.providerRequestId).toBeTruthy();
    expect(JSON.stringify(started)).not.toContain(initiate.payerMobile);
    started.amounts.requestedCents = 1;
    expect((await provider.fetchStatus(started.providerPaymentId)).amounts.requestedCents).toBe(
      1_250,
    );
  });

  it("retries initiation safely and rejects conflicting key reuse", async () => {
    const first = await provider.initiate(initiate);
    const repeated = await provider.initiate(initiate);
    expect(repeated.providerPaymentId).toBe(first.providerPaymentId);
    await expect(provider.initiate({ ...initiate, amountCents: 1_251 })).rejects.toMatchObject({
      code: "conflict",
    });
    await expect(provider.fetchStatus("unknown-payment")).rejects.toMatchObject({
      code: "not-found",
    });
  });

  it("supports a cancellation operation or declares it unsupported", async () => {
    const started = await provider.initiate(initiate);
    if (!provider.capabilities.cancel) {
      await expect(
        provider.cancel({
          providerPaymentId: started.providerPaymentId,
          idempotencyKey: "cancel-1",
        }),
      ).rejects.toMatchObject({ code: "unsupported" });
      return;
    }
    const cancelled = await provider.cancel({
      providerPaymentId: started.providerPaymentId,
      idempotencyKey: "cancel-1",
    });
    expect(cancelled.status).toBe("cancelled");
    expect((await provider.fetchStatus(started.providerPaymentId)).status).toBe("cancelled");
    expect(
      (
        await provider.cancel({
          providerPaymentId: started.providerPaymentId,
          idempotencyKey: "cancel-1",
        })
      ).status,
    ).toBe("cancelled");
  });

  it("supports bounded refunds or explicitly declares manual refunds", async () => {
    const started = await provider.initiate(initiate);
    const request = {
      providerPaymentId: started.providerPaymentId,
      amountCents: 500,
      idempotencyKey: "refund-1",
    };
    if (!provider.capabilities.refund) {
      await expect(provider.refund(request)).rejects.toMatchObject({ code: "unsupported" });
      return;
    }
    // A fake-specific settlement hook is required to exercise the generic refund contract.
    expect(provider).toBeInstanceOf(FakePaymentProvider);
    (provider as FakePaymentProvider).simulateEvent(
      started.providerPaymentId,
      "PAID",
      1_250,
      "event-paid-1",
    );
    const partial = await provider.refund(request);
    expect(partial).toMatchObject({
      status: "partially-refunded",
      amounts: { refundedCents: 500 },
    });
    const final = await provider.refund({
      providerPaymentId: started.providerPaymentId,
      amountCents: 750,
      idempotencyKey: "refund-2",
    });
    expect(final).toMatchObject({ status: "refunded", amounts: { refundedCents: 1_250 } });
    await expect(
      provider.refund({
        providerPaymentId: started.providerPaymentId,
        amountCents: 1,
        idempotencyKey: "refund-3",
      }),
    ).rejects.toThrow();
  });

  it("verifies raw webhook bytes before mapping and rejects tampering", async () => {
    const started = await provider.initiate(initiate);
    const payload = {
      paymentId: started.providerPaymentId,
      eventId: "event-paid-1",
      code: "PAID",
      amountCents: 1_250,
      responseCode: "PAID",
      occurredAt: now.toISOString(),
    };
    const envelope = sign(JSON.stringify(payload));
    if (!provider.capabilities.webhook) {
      expect(await provider.verifyWebhook(envelope)).toBeNull();
      return;
    }
    const verified = await provider.verifyWebhook(envelope);
    expect(verified).not.toBeNull();
    expect(provider.mapEvent(verified!)).toMatchObject({
      kind: "payment.captured",
      providerEventId: "event-paid-1",
      amountCents: 1_250,
      source: "provider",
    });
    expect(
      await provider.verifyWebhook({ ...envelope, rawBody: `${envelope.rawBody} ` }),
    ).toBeNull();
    expect(await provider.verifyWebhook({ ...envelope, signature: "sha256=invalid" })).toBeNull();
    expect(await provider.verifyWebhook({ ...envelope, timestamp: "0000000000" })).toBeNull();
  });
}

describe("deterministic fake payment provider contract", () => {
  providerContract(() => new FakePaymentProvider(secret, () => now));

  it("rejects malformed signed payloads and unknown event codes", async () => {
    const provider = new FakePaymentProvider(secret, () => now);
    const started = await provider.initiate(initiate);
    expect(
      await provider.verifyWebhook(
        sign(
          JSON.stringify({
            paymentId: started.providerPaymentId,
            eventId: "bad-event",
            code: "INVENTED",
            amountCents: 1_250,
            responseCode: "PAID",
            occurredAt: now.toISOString(),
          }),
        ),
      ),
    ).toBeNull();
    expect(await provider.verifyWebhook(sign("not-json"))).toBeNull();
    expect(() =>
      provider.mapEvent({
        providerPaymentId: started.providerPaymentId,
        providerEventId: "unknown",
        code: "INVENTED",
        amountCents: null,
        responseCode: null,
        occurredAt: now,
      }),
    ).toThrow();
  });

  it("emits a deterministic signed sandbox event that maps to the recorded status", async () => {
    const provider = new FakePaymentProvider(secret, () => now);
    const started = await provider.initiate(initiate);
    const envelope = provider.simulateEvent(
      started.providerPaymentId,
      "PAID",
      1_250,
      "event-paid-2",
    );
    const verified = await provider.verifyWebhook(envelope);
    expect(verified).not.toBeNull();
    expect(provider.mapEvent(verified!)).toMatchObject({
      kind: "payment.captured",
      eventKey: "provider:event-paid-2",
      amountCents: 1_250,
    });
    expect((await provider.fetchStatus(started.providerPaymentId)).status).toBe("paid");
    expect(() =>
      provider.simulateEvent(started.providerPaymentId, "PAID", 1_250, "event-paid-2"),
    ).toThrow();
  });

  it("rejects conflicting cancellation keys and supports a no-refund launch capability", async () => {
    const provider = new FakePaymentProvider(secret, () => now, {
      cancel: true,
      refund: false,
      webhook: true,
    });
    const started = await provider.initiate(initiate);
    await provider.cancel({
      providerPaymentId: started.providerPaymentId,
      idempotencyKey: "cancel-1",
    });
    await expect(
      provider.refund({
        providerPaymentId: started.providerPaymentId,
        amountCents: 1,
        idempotencyKey: "refund-1",
      }),
    ).rejects.toMatchObject({ code: "unsupported" });
    await expect(
      provider.cancel({ providerPaymentId: "other", idempotencyKey: "cancel-1" }),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(new PaymentProviderError("unsupported", "test").code).toBe("unsupported");
  });
});
