import { createApplicationLogger } from "../observability/logger";
import type { ApplicationLogger } from "../observability/types";

type MetricDefinition = {
  "http.request": { value: number; unit: "ms"; method: string; statusClass: string };
  "database.command": {
    value: number;
    unit: "ms";
    command: string;
    outcome: "success" | "failure";
  };
  "media.upload.failure": {
    value: 1;
    unit: "count";
    reason: "validation" | "storage" | "processing" | "unknown";
  };
  "checkout.attempt": { value: 1; unit: "count"; outcome: "started" | "succeeded" | "failed" };
  "payment.outcome": {
    value: 1;
    unit: "count";
    provider: "mbway" | "cash" | "other";
    outcome: "succeeded" | "failed" | "pending" | "refunded";
  };
  "webhook.delay": {
    value: number;
    unit: "ms";
    provider: "mbway" | "other";
    outcome: "accepted" | "rejected";
  };
  "order.created": { value: 1; unit: "count"; fulfillment: "delivery" | "pickup" };
};

export type OperationalMetricName = keyof MetricDefinition;
export type OperationalMetricInput = {
  [Name in OperationalMetricName]: Readonly<
    { name: Name; requestId?: string } & MetricDefinition[Name]
  >;
}[OperationalMetricName];

const HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);
const MONGO_COMMANDS = new Set([
  "aggregate",
  "count",
  "delete",
  "distinct",
  "find",
  "findAndModify",
  "getMore",
  "insert",
  "ping",
  "update",
  "commitTransaction",
  "abortTransaction",
]);

function safeDimension(value: string, allowlist: ReadonlySet<string>): string {
  return allowlist.has(value) ? value : "other";
}

export function recordOperationalMetric(
  input: OperationalMetricInput,
  options: { logger?: ApplicationLogger } = {},
): void {
  if (!Number.isFinite(input.value) || input.value < 0) {
    throw new RangeError("Metric values must be finite and nonnegative.");
  }
  const logger =
    options.logger ??
    createApplicationLogger({
      module: "metrics",
      ...(input.requestId ? { requestId: input.requestId } : {}),
    });
  const safeDimensions = Object.fromEntries(
    Object.entries(input).filter(([key]) => key !== "name" && key !== "requestId"),
  ) as Record<string, string | number>;
  safeDimensions.value = Math.round(input.value * 1_000) / 1_000;
  if (input.name === "http.request") {
    safeDimensions.method = safeDimension(input.method, HTTP_METHODS);
    safeDimensions.statusClass = /^[1-5]xx$/u.test(input.statusClass) ? input.statusClass : "other";
  }
  if (input.name === "database.command") {
    safeDimensions.command = safeDimension(input.command, MONGO_COMMANDS);
  }
  logger.info({
    action: `metric.${input.name}`,
    context: safeDimensions,
    message: "Operational metric recorded.",
  });
}
