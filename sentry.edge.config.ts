import * as Sentry from "@sentry/nextjs";

import { sanitizeMonitoringEvent } from "./src/lib/monitoring/sanitize-event";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: process.env.SENTRY_ENABLED === "true",
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  release: process.env.SENTRY_RELEASE ?? process.env.DEPLOYMENT_VERSION,
  sendDefaultPii: false,
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
  beforeSend: sanitizeMonitoringEvent,
  beforeSendTransaction: sanitizeMonitoringEvent,
});
