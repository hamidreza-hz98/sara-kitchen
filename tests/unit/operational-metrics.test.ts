import { EventEmitter } from "node:events";

import { describe, expect, it, vi } from "vitest";
import type { Connection } from "mongoose";

import { createApplicationLogger } from "@/server/observability/logger";
import type { StructuredLogEvent } from "@/server/observability/types";
import { recordOperationalMetric } from "@/server/metrics";
import { observeMongoCommands } from "@/server/metrics/mongo-command-observer";

describe("operational metrics", () => {
  it("writes typed, queryable JSON without high-cardinality or secret dimensions", () => {
    const lines: string[] = [];
    const events: StructuredLogEvent[] = [];
    const logger = createApplicationLogger({
      module: "metrics",
      mode: "json",
      minimumLevel: "info",
      write: (line, event) => {
        lines.push(line);
        events.push(event);
      },
    });

    recordOperationalMetric(
      {
        name: "http.request",
        method: "POST",
        statusClass: "5xx",
        requestId: "request-123",
        unit: "ms",
        value: 31.25,
      },
      { logger },
    );
    recordOperationalMetric(
      { name: "media.upload.failure", reason: "storage", unit: "count", value: 1 },
      { logger },
    );
    recordOperationalMetric(
      { name: "checkout.attempt", outcome: "started", unit: "count", value: 1 },
      { logger },
    );
    recordOperationalMetric(
      { name: "payment.outcome", provider: "mbway", outcome: "failed", unit: "count", value: 1 },
      { logger },
    );
    recordOperationalMetric(
      { name: "webhook.delay", provider: "mbway", outcome: "accepted", unit: "ms", value: 1200 },
      { logger },
    );
    recordOperationalMetric(
      { name: "order.created", fulfillment: "delivery", unit: "count", value: 1 },
      { logger },
    );

    expect(events.map((event) => event.action)).toEqual([
      "metric.http.request",
      "metric.media.upload.failure",
      "metric.checkout.attempt",
      "metric.payment.outcome",
      "metric.webhook.delay",
      "metric.order.created",
    ]);
    expect(events[0]?.context).toEqual({
      method: "POST",
      statusClass: "5xx",
      unit: "ms",
      value: 31.25,
    });
    expect(events[0]?.context).not.toHaveProperty("requestId");
    expect(lines.every((line) => JSON.parse(line).module === "metrics")).toBe(true);
  });

  it("bounds high-cardinality labels and rejects invalid values", () => {
    const events: StructuredLogEvent[] = [];
    const logger = createApplicationLogger({
      module: "metrics",
      write: (_line, event) => events.push(event),
    });
    recordOperationalMetric(
      {
        name: "database.command",
        command: "customer-secret",
        outcome: "failure",
        unit: "ms",
        value: 5,
      },
      { logger },
    );
    expect(events[0]?.context?.command).toBe("other");
    expect(() =>
      recordOperationalMetric(
        {
          name: "database.command",
          command: "find",
          outcome: "success",
          unit: "ms",
          value: Number.NaN,
        },
        { logger },
      ),
    ).toThrow(RangeError);
  });

  it("observes one MongoDB client once and never includes command payloads", async () => {
    const source = new EventEmitter() as ReturnType<Connection["getClient"]>;
    const record = vi.fn();
    observeMongoCommands(source, record);
    observeMongoCommands(source, record);
    (source as unknown as EventEmitter).emit("commandSucceeded", {
      commandName: "find",
      duration: 12,
      command: { password: "private-value" },
      reply: { token: "private-value" },
    });
    (source as unknown as EventEmitter).emit("commandFailed", {
      commandName: "update",
      duration: 23,
      failure: new Error("password=private-value"),
    });
    expect(record).toHaveBeenCalledTimes(2);
    expect(record.mock.calls.map(([metric]) => metric.outcome)).toEqual(["success", "failure"]);
    expect(JSON.stringify(record.mock.calls)).not.toContain("private-value");
  });
});
