import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  adminCookieName,
  clearAdminCookie,
  serializeAdminCookie,
} from "@/server/modules/auth/policy/admin-cookie";
import { isSameOriginMutation } from "@/server/modules/auth/policy/same-origin";

describe("admin authentication transport policy", () => {
  const expiry = new Date(Date.now() + 60_000);

  it("uses host-only secure, HttpOnly, strict cookies in production", () => {
    const cookie = serializeAdminCookie("opaque-token", expiry, true);
    expect(adminCookieName(true)).toBe("__Host-sara_admin");
    expect(cookie).toContain("__Host-sara_admin=opaque-token");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).not.toContain("Domain=");
    expect(clearAdminCookie(true)).toContain("Max-Age=0");
  });

  it("uses a separate localhost cookie name without Secure", () => {
    const cookie = serializeAdminCookie("opaque-token", expiry, false);
    expect(cookie).toContain("sara_admin_dev=opaque-token");
    expect(cookie).not.toContain("Secure");
    expect(cookie).toContain("HttpOnly");
  });

  it("rejects absent, malformed and foreign origins for mutating requests", () => {
    const url = "https://kitchen.example/api/auth/admin/login";
    expect(
      isSameOriginMutation(new Request(url, { headers: { origin: "https://kitchen.example" } })),
    ).toBe(true);
    expect(isSameOriginMutation(new Request(url))).toBe(false);
    expect(
      isSameOriginMutation(new Request(url, { headers: { origin: "https://other.example" } })),
    ).toBe(false);
    expect(isSameOriginMutation(new Request(url, { headers: { origin: "null" } }))).toBe(false);
  });
});
