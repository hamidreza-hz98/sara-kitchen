import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { clearAdminCookie, serializeAdminCookie } from "@/server/modules/auth/policy/admin-cookie";
import {
  clearCustomerCookie,
  serializeCustomerCookie,
} from "@/server/modules/auth/policy/customer-cookie";
import {
  createContentSecurityPolicy,
  createSecurityHeaders,
} from "@/server/security/response-headers";

const mediaOrigin = "https://media.sara-kitchen.example";

function asRecord(headers: ReturnType<typeof createSecurityHeaders>): Record<string, string> {
  return Object.fromEntries(headers.map(({ key, value }) => [key, value]));
}

describe("production response security", () => {
  it("emits the complete production header baseline", () => {
    const headers = asRecord(createSecurityHeaders({ production: true, mediaOrigin }));
    expect(headers).toMatchObject({
      "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
      "X-Frame-Options": "DENY",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-DNS-Prefetch-Control": "off",
      "X-Permitted-Cross-Domain-Policies": "none",
      "X-XSS-Protection": "0",
    });
    expect(headers["Permissions-Policy"]).toContain("camera=()");
    expect(headers["Permissions-Policy"]).toContain("geolocation=(self)");
    expect(headers["Permissions-Policy"]).toContain("payment=()");
  });

  it("allows only the exact browser media and map origins", () => {
    const monitoringOrigin = "https://o1.ingest.sentry.io";
    const policy = createContentSecurityPolicy({
      production: true,
      mediaOrigin,
      monitoringOrigin,
    });
    expect(policy).toContain(
      `img-src 'self' data: blob: https://tile.openstreetmap.org ${mediaOrigin}`,
    );
    expect(policy).toContain(`media-src 'self' blob: ${mediaOrigin}`);
    expect(policy).toContain(`connect-src 'self' ${mediaOrigin} ${monitoringOrigin}`);
    expect(policy).toContain("frame-src https://www.openstreetmap.org");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("upgrade-insecure-requests");
    expect(policy).not.toContain("https://*");
    expect(policy).not.toContain("http://*");
    expect(policy).not.toContain("mbway");
    expect(policy).not.toContain("twilio");
    expect(policy).not.toContain("whatsapp");
    expect(policy).not.toContain("'unsafe-eval'");
  });

  it("keeps development usable without teaching browsers an HSTS policy", () => {
    const headers = asRecord(createSecurityHeaders({ production: false, mediaOrigin }));
    expect(headers).not.toHaveProperty("Strict-Transport-Security");
    expect(headers["Content-Security-Policy"]).toContain("'unsafe-eval'");
    expect(headers["Content-Security-Policy"]).toContain("ws:");
    expect(headers["Content-Security-Policy"]).not.toContain("upgrade-insecure-requests");
  });

  it("rejects broad, credentialed, and non-HTTP CSP source inputs", () => {
    expect(() =>
      createContentSecurityPolicy({ production: true, mediaOrigin: "https://*.example.com" }),
    ).toThrow();
    expect(() =>
      createContentSecurityPolicy({
        production: true,
        mediaOrigin: "https://user:pass@example.com",
      }),
    ).toThrow(/credential-free/u);
    expect(() =>
      createContentSecurityPolicy({ production: true, mediaOrigin: "javascript:alert(1)" }),
    ).toThrow(/HTTP or HTTPS/u);
    expect(() =>
      createContentSecurityPolicy({ production: true, mediaOrigin: "http://media.example.com" }),
    ).toThrow(/must use HTTPS/u);
    expect(() =>
      createContentSecurityPolicy({ production: true, mediaOrigin: "http://127.0.0.1:9000" }),
    ).not.toThrow();
  });

  it("keeps all credential cookies host-only and secure in production", () => {
    const expiry = new Date(Date.now() + 60_000);
    for (const cookie of [
      serializeAdminCookie("admin-token", expiry, true),
      serializeCustomerCookie("customer-token", expiry, true, true),
      clearAdminCookie(true),
      clearCustomerCookie(true),
    ]) {
      expect(cookie).toContain("Secure");
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("SameSite=Strict");
      expect(cookie).toContain("Path=/");
      expect(cookie).not.toContain("Domain=");
    }
  });
});
