export const LOG_LEVELS = ["debug", "info", "warn", "error", "fatal"] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];
export type LogOutputMode = "json" | "pretty";

export type SanitizedLogValue =
  | boolean
  | number
  | string
  | null
  | readonly SanitizedLogValue[]
  | { readonly [key: string]: SanitizedLogValue };

export type SanitizedLogRecord = Readonly<Record<string, SanitizedLogValue>>;

export type StructuredLogError = Readonly<{
  code: string | null;
  message: string;
  name: string;
  stack: string | null;
}>;

/** The one normalized event rendered by both local and production formatters. */
export type StructuredLogEvent = Readonly<{
  action: string;
  context: SanitizedLogRecord | null;
  deploymentVersion: string;
  durationMs: number | null;
  error: StructuredLogError | null;
  level: LogLevel;
  message: string;
  module: string;
  requestId: string | null;
  timestamp: string;
}>;

export type LogInput = Readonly<{
  action: string;
  context?: Readonly<Record<string, unknown>>;
  durationMs?: number;
  error?: unknown;
  message: string;
}>;

export type LogWriter = (line: string, event: StructuredLogEvent) => void;

export type ApplicationLogger = Readonly<{
  debug: (input: LogInput) => void;
  error: (input: LogInput) => void;
  fatal: (input: LogInput) => void;
  info: (input: LogInput) => void;
  warn: (input: LogInput) => void;
}>;
