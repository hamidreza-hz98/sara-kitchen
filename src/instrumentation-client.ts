import * as Sentry from "@sentry/nextjs";

import { sanitizeMonitoringEvent } from "@/lib/monitoring/sanitize-event";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NEXT_PUBLIC_SENTRY_ENABLED === "true",
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
  sendDefaultPii: false,
  tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0),
  beforeSend: sanitizeMonitoringEvent,
  beforeSendTransaction: sanitizeMonitoringEvent,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
