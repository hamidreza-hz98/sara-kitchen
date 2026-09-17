import { formatJsonLog, formatPrettyLog } from "./formatters";
import { redactLogText, sanitizeLogContext, serializeLogError } from "./redaction";
import { LOG_LEVELS } from "./types";
import type {
  ApplicationLogger,
  LogInput,
  LogLevel,
  LogOutputMode,
  LogWriter,
  StructuredLogEvent,
} from "./types";

const LOG_LEVEL_PRIORITY: Readonly<Record<LogLevel, number>> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  fatal: 50,
};

export type LoggerEnvironment = Readonly<Record<string, string | undefined>>;

export type CreateApplicationLoggerOptions = Readonly<{
  deploymentVersion?: string;
  environment?: LoggerEnvironment;
  minimumLevel?: LogLevel;
  mode?: LogOutputMode;
  module: string;
  now?: () => Date;
  requestId?: string | null;
  write?: LogWriter;
}>;

function resolveLogLevel(environment: LoggerEnvironment): LogLevel {
  const configured = environment.LOG_LEVEL?.trim().toLowerCase();
  if (configured && LOG_LEVELS.some((level) => level === configured)) return configured as LogLevel;
  return environment.NODE_ENV === "production" ? "info" : "debug";
}

function resolveLogMode(environment: LoggerEnvironment): LogOutputMode {
  return environment.NODE_ENV === "production" ? "json" : "pretty";
}

function normalizeLabel(value: string, fallback: string): string {
  const normalized = value
    .trim()
    .replaceAll(/[^A-Za-z0-9._:-]/gu, "-")
    .slice(0, 128);
  return normalized.length > 0 ? normalized : fallback;
}

export function resolveDeploymentVersion(environment: LoggerEnvironment = process.env): string {
  const candidate =
    environment.DEPLOYMENT_VERSION ??
    environment.VERCEL_GIT_COMMIT_SHA ??
    environment.VERCEL_DEPLOYMENT_ID ??
    environment.GITHUB_SHA ??
    environment.COMMIT_SHA;
  return candidate
    ? normalizeLabel(candidate, "unknown")
    : environment.NODE_ENV === "production"
      ? "unknown"
      : "local";
}

function defaultWriter(line: string, event: StructuredLogEvent): void {
  const stream =
    LOG_LEVEL_PRIORITY[event.level] >= LOG_LEVEL_PRIORITY.warn ? process.stderr : process.stdout;
  stream.write(`${line}\n`);
}

function normalizeDuration(durationMs: number | undefined): number | null {
  if (durationMs === undefined) return null;
  if (!Number.isFinite(durationMs) || durationMs < 0) return null;
  return Math.round(durationMs * 1_000) / 1_000;
}

export function createApplicationLogger(
  options: CreateApplicationLoggerOptions,
): ApplicationLogger {
  const environment = options.environment ?? process.env;
  const minimumLevel = options.minimumLevel ?? resolveLogLevel(environment);
  const mode = options.mode ?? resolveLogMode(environment);
  const moduleName = normalizeLabel(options.module, "unknown");
  const deploymentVersion = normalizeLabel(
    options.deploymentVersion ?? resolveDeploymentVersion(environment),
    "unknown",
  );
  const requestId = options.requestId ? normalizeLabel(options.requestId, "unknown") : null;
  const now = options.now ?? (() => new Date());
  const write = options.write ?? defaultWriter;

  function emit(level: LogLevel, input: LogInput): void {
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[minimumLevel]) return;
    const event: StructuredLogEvent = {
      action: normalizeLabel(input.action, "unknown"),
      context: input.context ? sanitizeLogContext(input.context) : null,
      deploymentVersion,
      durationMs: normalizeDuration(input.durationMs),
      error: input.error === undefined ? null : serializeLogError(input.error),
      level,
      message: redactLogText(input.message),
      module: moduleName,
      requestId,
      timestamp: now().toISOString(),
    };
    write(mode === "json" ? formatJsonLog(event) : formatPrettyLog(event), event);
  }

  return {
    debug: (input) => emit("debug", input),
    error: (input) => emit("error", input),
    fatal: (input) => emit("fatal", input),
    info: (input) => emit("info", input),
    warn: (input) => emit("warn", input),
  };
}
