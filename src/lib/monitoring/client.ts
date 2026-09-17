"use client";

import * as Sentry from "@sentry/nextjs";

export function captureClientException(error: Error & { digest?: string }): string {
  return Sentry.withScope((scope) => {
    scope.setTag("runtime", "browser");
    scope.setTag("alert_route", "frontend");
    if (error.digest) scope.setTag("next_digest", error.digest);
    return Sentry.captureException(error);
  });
}
