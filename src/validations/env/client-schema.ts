import { z } from "zod";

import { EnvironmentValidationError } from "./error";

const emptyStringToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalPublicText = z.preprocess(
  emptyStringToUndefined,
  z.string().trim().min(1).optional(),
);
const optionalPublicUrl = z.preprocess(
  emptyStringToUndefined,
  z.string().trim().url("NEXT_PUBLIC_SENTRY_DSN must be a valid URL.").optional(),
);
const optionalSampleRate = z.preprocess(
  emptyStringToUndefined,
  z.coerce.number().min(0).max(1).optional(),
);
const publicBooleanString = z
  .enum(["true", "false"], {
    error: 'NEXT_PUBLIC_SENTRY_ENABLED must be either "true" or "false".',
  })
  .transform((value) => value === "true");

export const CLIENT_ENVIRONMENT_KEYS = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_SENTRY_ENABLED",
  "NEXT_PUBLIC_SENTRY_DSN",
  "NEXT_PUBLIC_SENTRY_ENVIRONMENT",
  "NEXT_PUBLIC_SENTRY_RELEASE",
  "NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE",
] as const;

export const clientEnvironmentSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z
    .string({ error: "NEXT_PUBLIC_SITE_URL is required." })
    .trim()
    .url("NEXT_PUBLIC_SITE_URL must be an absolute URL."),
  NEXT_PUBLIC_SENTRY_ENABLED: publicBooleanString.default(false),
  NEXT_PUBLIC_SENTRY_DSN: optionalPublicUrl,
  NEXT_PUBLIC_SENTRY_ENVIRONMENT: optionalPublicText,
  NEXT_PUBLIC_SENTRY_RELEASE: optionalPublicText,
  NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: optionalSampleRate,
});

export type ClientEnvironment = z.output<typeof clientEnvironmentSchema>;

export function parseClientEnvironment(source: unknown): ClientEnvironment {
  const result = clientEnvironmentSchema.safeParse(source);

  if (!result.success) {
    throw new EnvironmentValidationError("client", result.error.issues);
  }

  return Object.freeze(result.data);
}
