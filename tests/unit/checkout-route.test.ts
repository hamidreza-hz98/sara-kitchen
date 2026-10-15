import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/modules/auth", () => ({
  isSameOriginMutation: (request: Request) =>
    request.headers.get("origin") === "https://sarakitchen.pt",
}));
const state = vi.hoisted(() => ({ checkout: vi.fn(), enabled: false }));
vi.mock("@/app/api/cart/route-helper", () => ({
  cartRequestContext: vi.fn(async () => ({
    connection: {},
    identity: { kind: "customer", customerId: "1".repeat(24) },
  })),
  cartRequestLocale: () => "en",
}));
vi.mock("@/server/environment", () => ({
  getServerEnvironment: () => ({
    MBWAY_ENABLED: state.enabled,
    MBWAY_WEBHOOK_SECRET: "a".repeat(32),
    KITCHEN_LATITUDE: 41.15,
    KITCHEN_LONGITUDE: -8.61,
  }),
}));
vi.mock("@/server/modules/settings", () => ({
  createSettingsRuntime: () => ({ getPublic: async () => null }),
}));
vi.mock("@/server/modules/orders", () => ({ submitAtomicCheckout: state.checkout }));
vi.mock("@/server/modules/transactions", () => ({
  createLocalMbWaySandboxProvider: () => ({ id: "fake" }),
}));

import { POST } from "@/app/api/checkout/route";

const body = JSON.stringify({
  expectedCartVersion: 1,
  paymentMethod: "mbway",
  paymentPhone: "+351912345678",
  acceptedPolicies: [
    { id: "a".repeat(24), version: 1 },
    { id: "b".repeat(24), version: 1 },
  ],
});

beforeEach(() => {
  state.enabled = false;
  state.checkout.mockReset();
});

describe("checkout route", () => {
  it("fails closed when sandbox is disabled", async () => {
    const response = await POST(
      new Request("https://sarakitchen.pt/api/checkout", {
        method: "POST",
        headers: {
          origin: "https://sarakitchen.pt",
          "content-type": "application/json",
          "idempotency-key": "checkout-key-123456",
        },
        body,
      }) as never,
    );
    expect(response.status).toBe(503);
    expect(state.checkout).not.toHaveBeenCalled();
  });

  it("rejects cross-origin attempts", async () => {
    const response = await POST(
      new Request("https://sarakitchen.pt/api/checkout", {
        method: "POST",
        headers: { origin: "https://attacker.test" },
      }) as never,
    );
    expect(response.status).toBe(403);
  });

  it("requires a stable key and delegates a valid submission", async () => {
    state.enabled = true;
    state.checkout.mockResolvedValue({
      orderCode: "SK-ABCD-EFGH-JKLM-NPQR",
      paymentStatus: "pending",
    });
    const headers = { origin: "https://sarakitchen.pt", "content-type": "application/json" };
    const invalid = await POST(
      new Request("https://sarakitchen.pt/api/checkout", {
        method: "POST",
        headers,
        body,
      }) as never,
    );
    expect(invalid.status).toBe(400);
    const valid = await POST(
      new Request("https://sarakitchen.pt/api/checkout", {
        method: "POST",
        headers: { ...headers, "idempotency-key": "checkout-key-123456" },
        body,
      }) as never,
    );
    expect(valid.status).toBe(200);
    expect(state.checkout).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: "checkout-key-123456",
        customerId: "1".repeat(24),
      }),
    );
  });
});
