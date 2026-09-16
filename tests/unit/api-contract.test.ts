import { describe, expect, it, vi } from "vitest";

import { apiSuccess } from "@/server/http/api-contract";
import { ApiError } from "@/server/http/api-error";
import { handleApiRoute, REQUEST_ID_PATTERN } from "@/server/http/route-handler";

async function responseBody(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

describe("HTTP API contract", () => {
  it("returns the success envelope, metadata, status, and propagated request ID", async () => {
    const response = await handleApiRoute(
      new Request("https://example.test/api/items", {
        headers: { "x-request-id": "gateway-request_42" },
      }),
      ({ requestId }) =>
        apiSuccess(
          { id: "dish-1", observedRequestId: requestId },
          { headers: { "x-page": "2" }, meta: { page: 2 }, status: 201 },
        ),
    );

    expect(response.status).toBe(201);
    expect(response.headers.get("x-request-id")).toBe("gateway-request_42");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-page")).toBe("2");
    await expect(responseBody(response)).resolves.toEqual({
      data: { id: "dish-1", observedRequestId: "gateway-request_42" },
      meta: { page: 2 },
      ok: true,
      requestId: "gateway-request_42",
    });
  });

  it("replaces malformed inbound request IDs", async () => {
    const response = await handleApiRoute(
      new Request("https://example.test/api/items", {
        headers: { "x-request-id": "bad id value" },
      }),
      () => apiSuccess({ status: "ok" }),
    );
    const body = await responseBody(response);

    expect(body.requestId).toEqual(expect.any(String));
    expect(REQUEST_ID_PATTERN.test(body.requestId as string)).toBe(true);
    expect(body.requestId).not.toBe("bad id value");
    expect(response.headers.get("x-request-id")).toBe(body.requestId);
  });

  it.each([
    [
      ApiError.validation([{ code: "required", message: "Name is required.", path: ["name"] }]),
      400,
      "validation",
      "VALIDATION_ERROR",
    ],
    [ApiError.authentication(), 401, "authentication", "AUTHENTICATION_REQUIRED"],
    [ApiError.authorization(), 403, "authorization", "ACCESS_DENIED"],
    [ApiError.notFound("dish"), 404, "notFound", "NOT_FOUND"],
    [ApiError.conflict({ field: "slug", resource: "dish" }), 409, "conflict", "CONFLICT"],
    [ApiError.rateLimit(30), 429, "rateLimit", "RATE_LIMITED"],
    [
      ApiError.unavailable({ mongodb: "ready", objectStorage: "unavailable" }),
      503,
      "unavailable",
      "SERVICE_UNAVAILABLE",
    ],
  ] as const)(
    "serializes %s as the stable public failure shape",
    async (error, status, type, code) => {
      const response = await handleApiRoute(
        new Request("https://example.test/api/items", {
          headers: { "x-request-id": "request-123" },
        }),
        () => {
          throw error;
        },
      );
      const body = await responseBody(response);

      expect(response.status).toBe(status);
      expect(body).toMatchObject({
        error: { code, type },
        ok: false,
        requestId: "request-123",
      });
      if (type === "rateLimit") expect(response.headers.get("retry-after")).toBe("30");
    },
  );

  it("preserves allowlisted validation details", async () => {
    const response = await handleApiRoute(new Request("https://example.test/api/items"), () => {
      throw ApiError.validation([
        { code: "too_small", message: "Name is required.", path: ["translations", 0, "name"] },
      ]);
    });

    await expect(responseBody(response)).resolves.toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
        details: {
          issues: [
            {
              code: "too_small",
              message: "Name is required.",
              path: ["translations", 0, "name"],
            },
          ],
        },
      },
    });
  });

  it("never exposes unknown error messages, causes, or stacks", async () => {
    const secret = new Error("DATABASE_PASSWORD=never-expose");
    secret.stack = "SUPER_SECRET_STACK";
    const reporter = vi.fn();
    const response = await handleApiRoute(
      new Request("https://example.test/api/private", {
        headers: { "x-request-id": "internal-request" },
      }),
      () => {
        throw secret;
      },
      { onInternalError: reporter },
    );
    const body = await responseBody(response);
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred.",
        type: "internal",
      },
      ok: false,
      requestId: "internal-request",
    });
    expect(serialized).not.toContain("DATABASE_PASSWORD");
    expect(serialized).not.toContain("SUPER_SECRET_STACK");
    expect(serialized).not.toContain("stack");
    expect(serialized).not.toContain("cause");
    expect(reporter).toHaveBeenCalledWith(secret, {
      method: "GET",
      pathname: "/api/private",
      requestId: "internal-request",
    });
  });

  it("rejects invalid success statuses and rate-limit durations", () => {
    expect(() => apiSuccess({}, { status: 204 })).toThrow(RangeError);
    expect(() => apiSuccess({}, { status: 500 })).toThrow(RangeError);
    expect(() => ApiError.rateLimit(0)).toThrow(RangeError);
  });
});
