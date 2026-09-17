import type { Event } from "@sentry/nextjs";

export const MONITORING_REDACTION_MARKER = "[REDACTED]";

const SENSITIVE_KEY =
  /(?:api.?key|authorization|card|cookie|credential|cvc|cvv|password|private.?key|session|signature|secret|token)/iu;
const INLINE_SECRETS = [
  /\bBearer\s+[A-Za-z0-9._~+/=-]+\b/giu,
  /\$argon2(?:id|i|d)\$[^\s]+/giu,
  /\b(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql|redis):\/\/[^\s]+/giu,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/gu,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/gu,
  /\b(?:password|passwd|pwd|token|secret|api[_-]?key|authorization|cookie|session[_-]?id)\s*[:=]\s*[^\s,;]+/giu,
] as const;

function redactText(value: string): string {
  let output = value;
  for (const pattern of INLINE_SECRETS)
    output = output.replace(pattern, MONITORING_REDACTION_MARKER);
  return output.slice(0, 8_000);
}

function sanitizeValue(value: unknown, seen = new WeakSet<object>(), depth = 0): unknown {
  if (typeof value === "string") return redactText(value);
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (value === undefined) return undefined;
  if (depth >= 6) return "[MAX_DEPTH]";
  if (typeof value !== "object") return String(value);
  if (seen.has(value)) return "[CIRCULAR]";
  seen.add(value);
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeValue(item, seen, depth + 1));
  }
  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 50)
      .map(([key, item]) => [
        key,
        SENSITIVE_KEY.test(key)
          ? MONITORING_REDACTION_MARKER
          : sanitizeValue(item, seen, depth + 1),
      ]),
  );
}

function safeUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return redactText(value.split(/[?#]/u, 1)[0] ?? "");
  }
}

/** Remove identity, payloads, credentials and URL queries while preserving symbolication fields. */
export function sanitizeMonitoringEvent<EventType extends Event>(event: EventType): EventType {
  const requestId = event.request?.headers?.["x-request-id"];
  const exception = event.exception?.values?.map((value) => ({
    ...value,
    value: value.value ? redactText(value.value) : value.value,
    stacktrace: value.stacktrace
      ? {
          ...value.stacktrace,
          frames: value.stacktrace.frames?.map((frame) => ({
            ...frame,
            vars: undefined,
            pre_context: undefined,
            context_line: undefined,
            post_context: undefined,
          })),
        }
      : value.stacktrace,
  }));

  const sanitized = {
    ...event,
    message: event.message ? redactText(event.message) : event.message,
    user: undefined,
    request: event.request
      ? {
          method: event.request.method,
          url: safeUrl(event.request.url),
          headers:
            typeof requestId === "string" ? { "x-request-id": redactText(requestId) } : undefined,
        }
      : undefined,
    tags: {
      ...(sanitizeValue(event.tags) as Record<string, string>),
      ...(typeof requestId === "string" ? { request_id: redactText(requestId) } : {}),
    },
    extra: sanitizeValue(event.extra) as Event["extra"],
    contexts: sanitizeValue(event.contexts) as Event["contexts"],
    breadcrumbs: sanitizeValue(event.breadcrumbs) as Event["breadcrumbs"],
    exception: exception ? { ...event.exception, values: exception } : event.exception,
  };
  return sanitized as unknown as EventType;
}
