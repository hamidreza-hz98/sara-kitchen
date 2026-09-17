import {
  CLIENT_ENVIRONMENT_KEYS,
  type ClientEnvironment,
  parseClientEnvironment,
} from "../validations/env/client-schema";
import { type EnvironmentIssue, EnvironmentValidationError } from "../validations/env/error";
import {
  parseServerEnvironment,
  SERVER_ENVIRONMENT_KEYS,
  type ServerEnvironment,
} from "../validations/env/server-schema";

type EnvironmentSource = Record<string, string | undefined>;

let cachedEnvironment:
  Readonly<{ client: ClientEnvironment; server: ServerEnvironment }> | undefined;

function pickEnvironment<const Key extends string>(
  source: EnvironmentSource,
  keys: readonly Key[],
): Record<Key, string | undefined> {
  return Object.fromEntries(keys.map((key) => [key, source[key]])) as Record<
    Key,
    string | undefined
  >;
}

function findUnknownPublicVariables(source: EnvironmentSource): EnvironmentIssue[] {
  const allowedKeys = new Set<string>(CLIENT_ENVIRONMENT_KEYS);
  return Object.keys(source)
    .filter((key) => key.startsWith("NEXT_PUBLIC_") && !allowedKeys.has(key))
    .map((key) => ({
      path: [key],
      message: "Unrecognized public variable; remove it or explicitly add it to the client schema.",
    }));
}

export function validateEnvironment(
  source: EnvironmentSource = process.env,
): Readonly<{ client: ClientEnvironment; server: ServerEnvironment }> {
  if (source === process.env && cachedEnvironment) {
    return cachedEnvironment;
  }

  const issues = findUnknownPublicVariables(source);
  let client: ClientEnvironment | undefined;
  let server: ServerEnvironment | undefined;

  try {
    client = parseClientEnvironment(pickEnvironment(source, CLIENT_ENVIRONMENT_KEYS));
  } catch (error) {
    if (!(error instanceof EnvironmentValidationError)) {
      throw error;
    }
    issues.push(...error.issues);
  }

  try {
    server = parseServerEnvironment(pickEnvironment(source, SERVER_ENVIRONMENT_KEYS));
  } catch (error) {
    if (!(error instanceof EnvironmentValidationError)) {
      throw error;
    }
    issues.push(...error.issues);
  }

  if (issues.length > 0 || !client || !server) {
    throw new EnvironmentValidationError("environment", issues);
  }

  if (server.SENTRY_ENABLED && !client.NEXT_PUBLIC_SENTRY_DSN) {
    issues.push({
      path: ["NEXT_PUBLIC_SENTRY_DSN"],
      message: "NEXT_PUBLIC_SENTRY_DSN is required when SENTRY_ENABLED is true.",
    });
  }

  if (server.SENTRY_ENABLED !== client.NEXT_PUBLIC_SENTRY_ENABLED) {
    issues.push({
      path: ["NEXT_PUBLIC_SENTRY_ENABLED"],
      message: "NEXT_PUBLIC_SENTRY_ENABLED must match SENTRY_ENABLED.",
    });
  }

  if (issues.length > 0) {
    throw new EnvironmentValidationError("environment", issues);
  }

  const environment = Object.freeze({ client, server });

  if (source === process.env) {
    cachedEnvironment = environment;
  }

  return environment;
}

export function getServerEnvironment(): ServerEnvironment {
  return validateEnvironment().server;
}

export function getApplicationSiteUrl(): string {
  return validateEnvironment().client.NEXT_PUBLIC_SITE_URL;
}
