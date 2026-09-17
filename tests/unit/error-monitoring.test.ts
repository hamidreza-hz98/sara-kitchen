import { describe, expect, it } from "vitest";
import type { Event } from "@sentry/nextjs";

import {
  MONITORING_REDACTION_MARKER,
  sanitizeMonitoringEvent,
} from "@/lib/monitoring/sanitize-event";

describe("error monitoring privacy boundary", () => {
  it("redacts secrets and request payloads while preserving readable stack frames", () => {
    const event: Event = sanitizeMonitoringEvent({
      message: "controlled failure password=hunter2",
      user: { email: "customer@example.com", id: "customer-1" },
      request: {
        data: { card: "4111111111111111" },
        headers: {
          authorization: "Bearer private-token",
          cookie: "session=private-cookie",
          "x-request-id": "request-verified-123",
        },
        method: "POST",
        query_string: "token=private-query",
        url: "https://example.com/api/orders?token=private-query#private",
      },
      extra: {
        password: "private-password",
        note: "Bearer private-token",
      },
      exception: {
        values: [
          {
            type: "Error",
            value: "token=private-exception",
            stacktrace: {
              frames: [
                {
                  filename: "src/server/orders/service.ts",
                  function: "createOrder",
                  lineno: 42,
                  colno: 7,
                  vars: { password: "private-stack-value" },
                  context_line: "throw new Error(secret)",
                },
              ],
            },
          },
        ],
      },
    });

    expect(JSON.stringify(event)).not.toMatch(/hunter2|private-token|private-query|private-cookie/);
    expect(event.user).toBeUndefined();
    expect(event.request).toEqual({
      headers: { "x-request-id": "request-verified-123" },
      method: "POST",
      url: "https://example.com/api/orders",
    });
    expect(event.tags?.request_id).toBe("request-verified-123");
    expect(event.extra?.password).toBe(MONITORING_REDACTION_MARKER);
    expect(event.exception?.values?.[0]?.stacktrace?.frames?.[0]).toMatchObject({
      filename: "src/server/orders/service.ts",
      function: "createOrder",
      lineno: 42,
      colno: 7,
    });
    expect(event.exception?.values?.[0]?.stacktrace?.frames?.[0]?.vars).toBeUndefined();
  });
});
