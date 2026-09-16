import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  clearCustomerCookie,
  customerCookieName,
  serializeCustomerCookie,
} from "@/server/modules/auth/policy/customer-cookie";

describe("customer session cookie policy", () => {
  const expiry = new Date(Date.now() + 60_000);

  it("uses a separate host-only secure cookie in production", () => {
    const cookie = serializeCustomerCookie("opaque-token", expiry, true, true);
    expect(customerCookieName(true)).toBe("__Host-sara_customer");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).not.toContain("Domain=");
    expect(cookie).toContain("Max-Age=");
    expect(clearCustomerCookie(true)).toContain("Max-Age=0");
  });

  it("keeps default sessions browser-scoped without persistent expiry", () => {
    const cookie = serializeCustomerCookie("opaque-token", expiry, false, false);
    expect(cookie).toContain("sara_customer_dev=opaque-token");
    expect(cookie).not.toContain("Secure");
    expect(cookie).not.toContain("Max-Age=");
    expect(cookie).not.toContain("Expires=");
  });
});
