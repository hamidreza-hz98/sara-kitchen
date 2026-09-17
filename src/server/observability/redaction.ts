import type { SanitizedLogRecord, SanitizedLogValue, StructuredLogError } from "./types";

export const LOG_REDACTION_MARKER = "[REDACTED]";
const CIRCULAR_MARKER = "[CIRCULAR]";
const TRUNCATED_MARKER = "…[TRUNCATED]";
const MAX_DEPTH = 6;
const MAX_ARRAY_ITEMS = 50;
const MAX_OBJECT_KEYS = 50;
const MAX_STRING_LENGTH = 2_000;
const MAX_STACK_LENGTH = 8_000;

const SENSITIVE_KEY_FRAGMENTS = [
  "apikey",
  "authorization",
  "cardnumber",
  "connectionstring",
  "cookie",
  "credential",
  "cvc",
  "cvv",
  "mongodburi",
  "pan",
  "passwd",
  "password",
  "privatekey",
  "sessionid",
  "sessiontoken",
  "signature",
  "secret",
  "token",
] as const;

const INLINE_SECRET_PATTERNS: readonly RegExp[] = [
  /\bBearer\s+[A-Za-z0-9._~+/=-]+\b/giu,
  /\$argon2(?:id|i|d)\$[^\s]+/giu,
  /\b(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql|redis):\/\/[^\s]+/giu,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/gu,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/gu,
  /\b[A-Za-z0-9_.-]*(?:password|passwd|pwd|token|secret|api[_-]?key|authorization|cookie|session[_-]?id)[A-Za-z0-9_.-]*\s*[:=]\s*[^\s,;]+/giu,
];

const SENSITIVE_STACK_IDENTIFIER =
  /(?:^|[^A-Za-z0-9])(?:password|passwd|pwd|token|secret|authorization|cookie|private[_-]?key)(?:[^A-Za-z0-9]|$)/iu;

function normalizeKey(key: string): string {
  return key.toLowerCase().replaceAll(/[^a-z0-9]/gu, "");
}

export function isSensitiveLogKey(key: string): boolean {
  const normalized = normalizeKey(key);
  return SENSITIVE_KEY_FRAGMENTS.some((fragment) => normalized.includes(fragment));
}

function truncate(value: string, maximum = MAX_STRING_LENGTH): string {
  if (value.length <= maximum) return value;
  return `${value.slice(0, maximum)}${TRUNCATED_MARKER}`;
}

/** Remove line-breaking control characters and recognizable inline credentials. */
export function redactLogText(value: string, maximum = MAX_STRING_LENGTH): string {
  let redacted = value
    .replaceAll("\r", "\\r")
    .replaceAll("\n", "\\n")
    .replaceAll("\t", "\\t")
    .replaceAll(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, "");
  for (const pattern of INLINE_SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, LOG_REDACTION_MARKER);
  }
  return truncate(redacted, maximum);
}

function sanitizeUnknown(input: unknown, seen: WeakSet<object>, depth: number): SanitizedLogValue {
  if (input === null) return null;
  if (typeof input === "string") return redactLogText(input);
  if (typeof input === "boolean") return input;
  if (typeof input === "number") return Number.isFinite(input) ? input : String(input);
  if (typeof input === "bigint") return `${input.toString()}n`;
  if (typeof input === "undefined") return "[UNDEFINED]";
  if (typeof input === "function") return "[FUNCTION]";
  if (typeof input === "symbol") return "[SYMBOL]";
  if (depth >= MAX_DEPTH) return "[MAX_DEPTH]";
  if (input instanceof Date)
    return Number.isNaN(input.valueOf()) ? "Invalid Date" : input.toISOString();
  if (input instanceof URL) return `${input.origin}${input.pathname}`;
  if (input instanceof Error) return serializeLogError(input);
  if (seen.has(input)) return CIRCULAR_MARKER;

  seen.add(input);
  if (Array.isArray(input)) {
    const values = input
      .slice(0, MAX_ARRAY_ITEMS)
      .map((value) => sanitizeUnknown(value, seen, depth + 1));
    if (input.length > MAX_ARRAY_ITEMS) values.push(TRUNCATED_MARKER);
    return values;
  }

  const output: Record<string, SanitizedLogValue> = {};
  const entries = Object.entries(input).slice(0, MAX_OBJECT_KEYS);
  for (const [key, value] of entries) {
    const safeKey = redactLogText(key, 128);
    output[safeKey] = isSensitiveLogKey(key)
      ? LOG_REDACTION_MARKER
      : sanitizeUnknown(value, seen, depth + 1);
  }
  if (Object.keys(input).length > MAX_OBJECT_KEYS) output._truncated = true;
  return output;
}

export function sanitizeLogContext(input: Readonly<Record<string, unknown>>): SanitizedLogRecord {
  return sanitizeUnknown(input, new WeakSet<object>(), 0) as SanitizedLogRecord;
}

export function serializeLogError(input: unknown): StructuredLogError {
  if (!(input instanceof Error)) {
    return {
      code: null,
      message: redactLogText(typeof input === "string" ? input : "Non-Error value thrown"),
      name: "NonError",
      stack: null,
    };
  }

  const code =
    "code" in input && typeof input.code === "string" ? redactLogText(input.code, 128) : null;
  const stack = input.stack
    ? SENSITIVE_STACK_IDENTIFIER.test(input.stack)
      ? LOG_REDACTION_MARKER
      : redactLogText(input.stack, MAX_STACK_LENGTH)
    : null;
  return {
    code,
    message: redactLogText(input.message),
    name: redactLogText(input.name, 128),
    stack,
  };
}
