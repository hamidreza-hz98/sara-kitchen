import { z } from "zod";

import { EnvironmentValidationError } from "./error";

export const CLIENT_ENVIRONMENT_KEYS = ["NEXT_PUBLIC_SITE_URL"] as const;

export const clientEnvironmentSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z
    .string({ error: "NEXT_PUBLIC_SITE_URL is required." })
    .trim()
    .url("NEXT_PUBLIC_SITE_URL must be an absolute URL."),
});

export type ClientEnvironment = z.output<typeof clientEnvironmentSchema>;

export function parseClientEnvironment(source: unknown): ClientEnvironment {
  const result = clientEnvironmentSchema.safeParse(source);

  if (!result.success) {
    throw new EnvironmentValidationError("client", result.error.issues);
  }

  return Object.freeze(result.data);
}
