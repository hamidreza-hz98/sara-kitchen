import { beforeEach, describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => ({
  captureException: vi.fn(() => "controlled-event-id"),
  setTag: vi.fn(),
  withScope: vi.fn(
    (callback: (scope: { setTag: (key: string, value: string) => void }) => string) =>
      callback({ setTag: (key, value) => sentry.setTag(key, value) }),
  ),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: sentry.captureException,
  withScope: sentry.withScope,
}));

import { captureClientException } from "@/lib/monitoring/client";
import { captureServerException } from "@/server/monitoring/capture-exception";

describe("controlled error capture", () => {
  beforeEach(() => vi.clearAllMocks());

  it("captures a client boundary error with frontend routing and digest tags", () => {
    const error = Object.assign(new Error("controlled client error"), { digest: "digest-42" });

    expect(captureClientException(error)).toBe("controlled-event-id");
    expect(sentry.captureException).toHaveBeenCalledWith(error);
    expect(sentry.setTag).toHaveBeenCalledWith("runtime", "browser");
    expect(sentry.setTag).toHaveBeenCalledWith("alert_route", "frontend");
    expect(sentry.setTag).toHaveBeenCalledWith("next_digest", "digest-42");
  });

  it("captures a server error with request correlation and backend routing", () => {
    const error = new Error("controlled server error");

    expect(
      captureServerException(error, {
        action: "request.failed",
        module: "orders",
        requestId: "request-42",
      }),
    ).toBe("controlled-event-id");
    expect(sentry.captureException).toHaveBeenCalledWith(error);
    expect(sentry.setTag).toHaveBeenCalledWith("runtime", "server");
    expect(sentry.setTag).toHaveBeenCalledWith("alert_route", "backend");
    expect(sentry.setTag).toHaveBeenCalledWith("module", "orders");
    expect(sentry.setTag).toHaveBeenCalledWith("request_id", "request-42");
  });
});
