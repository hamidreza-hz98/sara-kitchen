import type { StructuredLogEvent } from "./types";

export function formatJsonLog(event: StructuredLogEvent): string {
  return JSON.stringify(event);
}

/** Human-readable rendering of the exact event used by the JSON formatter. */
export function formatPrettyLog(event: StructuredLogEvent): string {
  const requestId = event.requestId ?? "-";
  const duration = event.durationMs === null ? "-" : `${event.durationMs}ms`;
  const context = event.context === null ? "null" : JSON.stringify(event.context);
  const error = event.error === null ? "null" : JSON.stringify(event.error);
  return `${event.timestamp} ${event.level.toUpperCase()} module=${event.module} action=${event.action} requestId=${requestId} duration=${duration} deployment=${event.deploymentVersion} message=${JSON.stringify(event.message)} context=${context} error=${error}`;
}
