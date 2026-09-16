import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { GET } from "@/app/api/health/route";

describe("health Route Handler validation contract", () => {
  it("returns the shared success envelope for a valid request", async () => {
    const response = await GET(new NextRequest("https://example.test/api/health"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { status: "ok" },
      ok: true,
      requestId: expect.any(String),
    });
  });

  it.each([
    ["pt-PT", "O pedido contém campos não suportados."],
    ["fa", "درخواست شامل فیلدهای پشتیبانی‌نشده است."],
  ])("returns a localized, field-safe 400 for invalid %s query input", async (locale, message) => {
    const request = new NextRequest("https://example.test/api/health?secret=private-value", {
      headers: { cookie: `SARA_LOCALE=${locale}`, "x-request-id": "health-42" },
    });
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(response.headers.get("x-request-id")).toBe("health-42");
    expect(body).toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
        details: { issues: [{ code: "unknown_fields", message, path: [] }] },
      },
      ok: false,
      requestId: "health-42",
    });
    expect(JSON.stringify(body)).not.toContain("private-value");
    expect(JSON.stringify(body)).not.toContain("secret");
  });
});
