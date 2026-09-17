import { createHmac } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/environment", () => ({
  getServerEnvironment: () => ({
    AUTH_SESSION_SECRET: "test-session-secret-with-at-least-32-characters",
  }),
}));

import {
  createCsrfToken,
  isProtectedMutation,
  verifyCsrfToken,
} from "@/server/modules/auth/policy/csrf";
import { isSameOriginMutation } from "@/server/modules/auth/policy/same-origin";
import { verifyMbWayWebhookSignature } from "@/server/modules/transactions";

describe("mutation request protections", () => {
  const url = "https://kitchen.example/api/auth/customer/logout";
  const session = "opaque-session";

  beforeEach(() => vi.useRealTimers());

  it("binds a CSRF token to both session and principal", () => {
    const token = createCsrfToken("customer", session);
    expect(verifyCsrfToken("customer", session, token)).toBe(true);
    expect(verifyCsrfToken("admin", session, token)).toBe(false);
    expect(verifyCsrfToken("customer", "another-session", token)).toBe(false);
    expect(verifyCsrfToken("customer", session, "invalid")).toBe(false);
  });

  it("requires same-origin fetch metadata and a valid token together", () => {
    const token = createCsrfToken("customer", session);
    const request = (headers: HeadersInit) =>
      new Request(url, {
        method: "POST",
        headers: { origin: "https://kitchen.example", ...headers },
      });
    expect(isProtectedMutation(request({ "x-csrf-token": token }), "customer", session)).toBe(true);
    expect(isProtectedMutation(request({}), "customer", session)).toBe(false);
    expect(
      isProtectedMutation(
        request({ "sec-fetch-site": "cross-site", "x-csrf-token": token }),
        "customer",
        session,
      ),
    ).toBe(false);
  });

  it("rejects host/proxy mismatches and accepts consistent forwarding metadata", () => {
    expect(
      isSameOriginMutation(
        new Request(url, {
          headers: { origin: "https://kitchen.example", host: "evil.example" },
        }),
      ),
    ).toBe(false);
    expect(
      isSameOriginMutation(
        new Request(url, {
          headers: {
            origin: "https://kitchen.example",
            host: "kitchen.example",
            "x-forwarded-host": "kitchen.example",
            "x-forwarded-proto": "https",
          },
        }),
      ),
    ).toBe(true);
  });

  it("verifies the timestamped MB Way sandbox signature and rejects tampering", () => {
    const rawBody = '{"eventId":"evt_123","status":"paid"}';
    const timestamp = "1789646400";
    const secret = "a-provider-webhook-secret-with-32-chars";
    const signature = `sha256=${createHmac("sha256", secret)
      .update(`${timestamp}.${rawBody}`)
      .digest("hex")}`;
    const input = {
      rawBody,
      signature,
      timestamp,
      secret,
      now: new Date(Number(timestamp) * 1_000),
    };
    expect(verifyMbWayWebhookSignature(input)).toBe(true);
    expect(verifyMbWayWebhookSignature({ ...input, rawBody: `${rawBody} ` })).toBe(false);
    expect(
      verifyMbWayWebhookSignature({ ...input, now: new Date((Number(timestamp) + 301) * 1_000) }),
    ).toBe(false);
  });
});
