import { describe, expect, it, vi } from "vitest";

import { formatJsonLog, formatPrettyLog } from "@/server/observability/formatters";
import {
  LOG_REDACTION_MARKER,
  sanitizeLogContext,
  serializeLogError,
} from "@/server/observability/redaction";
import { createApplicationLogger, resolveDeploymentVersion } from "@/server/observability/logger";
import type { StructuredLogEvent } from "@/server/observability/types";

const EVENT: StructuredLogEvent = {
  action: "request.completed",
  context: { method: "GET", statusCode: 200 },
  deploymentVersion: "commit-123",
  durationMs: 12.345,
  error: null,
  level: "info",
  message: "API request completed.",
  module: "http",
  requestId: "request-42",
  timestamp: "2026-09-18T00:00:00.000Z",
};

describe("structured application logging", () => {
  it("renders JSON and pretty output from the same complete typed event", () => {
    expect(JSON.parse(formatJsonLog(EVENT))).toEqual(EVENT);

    const pretty = formatPrettyLog(EVENT);
    expect(pretty).toContain(EVENT.timestamp);
    expect(pretty).toContain("INFO");
    expect(pretty).toContain(`module=${EVENT.module}`);
    expect(pretty).toContain(`action=${EVENT.action}`);
    expect(pretty).toContain(`requestId=${EVENT.requestId}`);
    expect(pretty).toContain(`duration=${EVENT.durationMs}ms`);
    expect(pretty).toContain(`deployment=${EVENT.deploymentVersion}`);
    expect(pretty).toContain(`message=${JSON.stringify(EVENT.message)}`);
    expect(pretty).toContain(`context=${JSON.stringify(EVENT.context)}`);
    expect(pretty).toContain("error=null");
  });

  it.each(["debug", "info", "warn", "error", "fatal"] as const)(
    "emits the normalized %s event with correlation fields",
    (level) => {
      const write = vi.fn();
      const logger = createApplicationLogger({
        deploymentVersion: "release-9",
        minimumLevel: "debug",
        mode: "json",
        module: "orders checkout",
        now: () => new Date("2026-09-18T01:02:03.000Z"),
        requestId: "request-9",
        write,
      });

      logger[level]({
        action: "checkout completed",
        context: { orderCode: "SK-1234" },
        durationMs: 18.12345,
        message: "Checkout completed.",
      });

      expect(write).toHaveBeenCalledOnce();
      const [line, event] = write.mock.calls[0] as [string, StructuredLogEvent];
      expect(JSON.parse(line)).toEqual(event);
      expect(event).toEqual({
        action: "checkout-completed",
        context: { orderCode: "SK-1234" },
        deploymentVersion: "release-9",
        durationMs: 18.123,
        error: null,
        level,
        message: "Checkout completed.",
        module: "orders-checkout",
        requestId: "request-9",
        timestamp: "2026-09-18T01:02:03.000Z",
      });
    },
  );

  it("filters events below the configured minimum level", () => {
    const write = vi.fn();
    const logger = createApplicationLogger({ minimumLevel: "warn", module: "media", write });

    logger.debug({ action: "upload.started", message: "Upload started." });
    logger.info({ action: "upload.completed", message: "Upload completed." });
    logger.warn({ action: "upload.slow", message: "Upload is slow." });

    expect(write).toHaveBeenCalledOnce();
  });

  it("recursively redacts keyed and inline secrets without failing on cycles", () => {
    const context: Record<string, unknown> = {
      authorization: "Bearer header-secret",
      nested: {
        apiKey: "provider-secret",
        note: "token=message-secret",
      },
      safe: "kept",
    };
    context.circular = context;

    const sanitized = sanitizeLogContext(context);
    expect(sanitized).toEqual({
      authorization: LOG_REDACTION_MARKER,
      circular: "[CIRCULAR]",
      nested: { apiKey: LOG_REDACTION_MARKER, note: LOG_REDACTION_MARKER },
      safe: "kept",
    });
  });

  it("redacts credentials in error messages and stacks", () => {
    const error = new Error("password=never-show");
    error.stack = "Error: Bearer access-token\n at handler (route.ts:1:1)";

    const serialized = serializeLogError(error);
    const output = JSON.stringify(serialized);
    expect(output).not.toContain("never-show");
    expect(output).not.toContain("access-token");
    expect(serialized.message).toBe(LOG_REDACTION_MARKER);
    expect(serialized.stack).toContain(LOG_REDACTION_MARKER);
  });

  it("resolves a stable deployment version with explicit and platform precedence", () => {
    expect(
      resolveDeploymentVersion({
        DEPLOYMENT_VERSION: "release-10",
        NODE_ENV: "production",
        VERCEL_GIT_COMMIT_SHA: "commit-ignored",
      }),
    ).toBe("release-10");
    expect(
      resolveDeploymentVersion({ NODE_ENV: "production", VERCEL_GIT_COMMIT_SHA: "commit-10" }),
    ).toBe("commit-10");
    expect(resolveDeploymentVersion({ NODE_ENV: "production" })).toBe("unknown");
    expect(resolveDeploymentVersion({ NODE_ENV: "development" })).toBe("local");
  });
});
