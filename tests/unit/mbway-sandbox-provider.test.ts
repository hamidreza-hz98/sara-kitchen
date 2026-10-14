import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { FakePaymentProvider } from "@/server/modules/transactions/provider/fake-payment-provider";
import {
  MbWaySandboxError,
  MbWaySandboxProvider,
  SandboxTransportError,
} from "@/server/modules/transactions/provider/mbway-sandbox-provider";
import { PaymentProviderError } from "@/server/modules/transactions/provider/payment-provider";

const now = new Date("2026-10-14T12:00:00.000Z");
const secret = "local-mbway-sandbox-secret-for-tests-only";
const request = {
  transactionId: "transaction-1",
  orderId: "order-1",
  amountCents: 1_200,
  currency: "EUR" as const,
  idempotencyKey: "mbway-init-1",
  payerMobile: "912 345 678",
};

function setup() {
  const fake = new FakePaymentProvider(secret, () => now);
  const provider = new MbWaySandboxProvider({ transport: fake, timeoutMs: 20, maxRetries: 1 });
  return { fake, provider };
}

describe("local MB Way sandbox adapter", () => {
  it("normalizes a Portuguese mobile, starts pending, and maps a signed success", async () => {
    const { fake, provider } = setup();
    const pending = await provider.initiate(request);
    expect(pending).toMatchObject({
      status: "pending",
      currency: "EUR",
      amounts: { requestedCents: 1_200, capturedCents: 0 },
    });
    expect(JSON.stringify(pending)).not.toMatch(/912345678|912 345 678/u);
    const envelope = fake.simulateEvent(pending.providerPaymentId, "PAID", 1_200, "paid-1");
    const verified = await provider.verifyWebhook(envelope);
    expect(verified).not.toBeNull();
    expect(provider.mapEvent(verified!)).toMatchObject({
      kind: "payment.captured",
      amountCents: 1_200,
    });
    expect((await provider.fetchStatus(pending.providerPaymentId)).status).toBe("paid");
  });

  it("reports rejection and expiry without falsely marking them paid", async () => {
    const { fake, provider } = setup();
    const rejected = await provider.initiate(request);
    fake.simulateEvent(rejected.providerPaymentId, "FAILED", null, "failed-1");
    expect((await provider.fetchStatus(rejected.providerPaymentId)).status).toBe("failed");

    const expired = await provider.initiate({
      ...request,
      idempotencyKey: "mbway-init-2",
      transactionId: "transaction-2",
    });
    fake.simulateEvent(expired.providerPaymentId, "EXPIRED", null, "expired-1");
    expect((await provider.fetchStatus(expired.providerPaymentId)).status).toBe("expired");
  });

  it("rejects invalid/non-Portuguese mobile and never calls the simulator", async () => {
    const fake = new FakePaymentProvider(secret, () => now);
    const spy = vi.spyOn(fake, "initiate");
    const provider = new MbWaySandboxProvider({ transport: fake });
    for (const payerMobile of ["+989121234567", "12345", "", "+351812345678"]) {
      await expect(provider.initiate({ ...request, payerMobile })).rejects.toMatchObject({
        code: "invalid-request",
      });
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("retries an ambiguous timeout only with the original idempotency key", async () => {
    const fake = new FakePaymentProvider(secret, () => now);
    const calls: string[] = [];
    const transport = {
      ...fake,
      initiate: vi.fn(async (input: typeof request) => {
        calls.push(input.idempotencyKey);
        if (calls.length === 1) return new Promise<never>(() => {});
        return fake.initiate(input);
      }),
      fetchStatus: fake.fetchStatus.bind(fake),
      cancel: fake.cancel.bind(fake),
      verifyWebhook: fake.verifyWebhook.bind(fake),
      mapEvent: fake.mapEvent.bind(fake),
    };
    const provider = new MbWaySandboxProvider({ transport, timeoutMs: 10, maxRetries: 1 });
    const result = await provider.initiate(request);
    expect(result.status).toBe("pending");
    expect(calls).toEqual([request.idempotencyKey, request.idempotencyKey]);
    expect((await provider.initiate(request)).providerPaymentId).toBe(result.providerPaymentId);
  });

  it("converges when the first provider attempt commits but its response is lost", async () => {
    const fake = new FakePaymentProvider(secret, () => now);
    let attempts = 0;
    const provider = new MbWaySandboxProvider({
      transport: {
        initiate: async (input) => {
          attempts += 1;
          const response = await fake.initiate(input);
          if (attempts === 1) throw new SandboxTransportError();
          return response;
        },
        fetchStatus: fake.fetchStatus.bind(fake),
        cancel: fake.cancel.bind(fake),
        verifyWebhook: fake.verifyWebhook.bind(fake),
        mapEvent: fake.mapEvent.bind(fake),
      },
      timeoutMs: 20,
      maxRetries: 1,
    });
    const response = await provider.initiate(request);
    expect(attempts).toBe(2);
    expect(response.providerPaymentId).toBe("fake_payment_1");
  });

  it("returns outcome-unknown after repeated timeouts and never creates a new key", async () => {
    const fake = new FakePaymentProvider(secret, () => now);
    const keys: string[] = [];
    const provider = new MbWaySandboxProvider({
      transport: {
        initiate: async (input) => {
          keys.push(input.idempotencyKey);
          return new Promise<never>(() => {});
        },
        fetchStatus: fake.fetchStatus.bind(fake),
        cancel: fake.cancel.bind(fake),
        verifyWebhook: fake.verifyWebhook.bind(fake),
        mapEvent: fake.mapEvent.bind(fake),
      },
      timeoutMs: 10,
      maxRetries: 1,
    });
    await expect(provider.initiate(request)).rejects.toMatchObject({ code: "outcome-unknown" });
    expect(keys).toEqual([request.idempotencyKey, request.idempotencyKey]);
  });

  it("retries transport faults but never validation/conflict failures", async () => {
    const fake = new FakePaymentProvider(secret, () => now);
    let attempts = 0;
    const provider = new MbWaySandboxProvider({
      transport: {
        initiate: async (input) => {
          attempts += 1;
          if (attempts === 1) throw new SandboxTransportError();
          return fake.initiate(input);
        },
        fetchStatus: fake.fetchStatus.bind(fake),
        cancel: fake.cancel.bind(fake),
        verifyWebhook: fake.verifyWebhook.bind(fake),
        mapEvent: fake.mapEvent.bind(fake),
      },
      timeoutMs: 20,
      maxRetries: 1,
    });
    expect((await provider.initiate(request)).status).toBe("pending");
    expect(attempts).toBe(2);
    await expect(provider.initiate({ ...request, amountCents: 1_201 })).rejects.toMatchObject({
      code: "conflict",
    });
    expect(attempts).toBe(3);
  });

  it("does not log mobile, idempotency keys, secrets, or raw provider errors", async () => {
    const fake = new FakePaymentProvider(secret, () => now);
    const logs: unknown[] = [];
    const provider = new MbWaySandboxProvider({
      transport: {
        initiate: async () => {
          throw new SandboxTransportError();
        },
        fetchStatus: fake.fetchStatus.bind(fake),
        cancel: fake.cancel.bind(fake),
        verifyWebhook: fake.verifyWebhook.bind(fake),
        mapEvent: fake.mapEvent.bind(fake),
      },
      timeoutMs: 20,
      maxRetries: 1,
      logger: { info: (value) => logs.push(value), warn: (value) => logs.push(value) },
    });
    await expect(provider.initiate(request)).rejects.toBeInstanceOf(MbWaySandboxError);
    const output = JSON.stringify(logs);
    expect(output).not.toContain("912345678");
    expect(output).not.toContain(request.idempotencyKey);
    expect(output).not.toContain(secret);
    expect(logs).toHaveLength(2);
  });

  it("supports idempotent cancellation while automated refunds remain disabled", async () => {
    const { provider } = setup();
    const pending = await provider.initiate(request);
    const cancelled = await provider.cancel({
      providerPaymentId: pending.providerPaymentId,
      idempotencyKey: "cancel-key-1",
    });
    expect(cancelled.status).toBe("cancelled");
    expect(
      (
        await provider.cancel({
          providerPaymentId: pending.providerPaymentId,
          idempotencyKey: "cancel-key-1",
        })
      ).status,
    ).toBe("cancelled");
    expect(provider.capabilities.refund).toBe(false);
    await expect(
      provider.refund({
        providerPaymentId: pending.providerPaymentId,
        amountCents: 100,
        idempotencyKey: "refund-key-1",
      }),
    ).rejects.toMatchObject({ code: "unsupported" });
    expect(new PaymentProviderError("invalid-request", "invalid").code).toBe("invalid-request");
  });

  it("cannot be instantiated as a production payment rail", () => {
    try {
      vi.stubEnv("NODE_ENV", "production");
      expect(
        () => new MbWaySandboxProvider({ transport: new FakePaymentProvider(secret, () => now) }),
      ).toThrow(/cannot be used in production/u);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
