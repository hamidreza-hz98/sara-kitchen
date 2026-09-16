import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

const { getReadiness } = vi.hoisted(() => ({ getReadiness: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/server/health/probes", () => ({ getReadiness }));

import { GET as health } from "@/app/api/health/route";
import { GET as ready } from "@/app/api/ready/route";

describe("health and readiness routes", () => {
  it("keeps liveness healthy while a required dependency is down", async () => {
    getReadiness.mockResolvedValue({
      status: "not_ready",
      dependencies: { mongodb: "ready", objectStorage: "unavailable" },
    });
    const live = await health(new NextRequest("https://example.test/api/health"));
    expect(live.status).toBe(200);
    expect(getReadiness).not.toHaveBeenCalled();

    const response = await ready(
      new NextRequest("https://example.test/api/ready", {
        headers: { "x-request-id": "ready-42" },
      }),
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-request-id")).toBe("ready-42");
    expect(await response.json()).toEqual({
      ok: false,
      requestId: "ready-42",
      error: {
        type: "unavailable",
        code: "SERVICE_UNAVAILABLE",
        message: "A required service is unavailable.",
        details: { dependencies: { mongodb: "ready", objectStorage: "unavailable" } },
      },
    });
  });

  it("returns a safe ready report when both dependencies are healthy", async () => {
    getReadiness.mockResolvedValue({
      status: "ready",
      dependencies: { mongodb: "ready", objectStorage: "ready" },
    });
    const response = await ready(new NextRequest("https://example.test/api/ready"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: { status: "ready", dependencies: { mongodb: "ready", objectStorage: "ready" } },
    });
  });
});
