import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs/config";

import { validateEnvironment } from "./src/server/environment-core";
import { createSecurityHeaders } from "./src/server/security/response-headers";

const environment = validateEnvironment();
const minioProtocol = environment.server.MINIO_USE_SSL ? "https" : "http";
const mediaOrigin = new URL(
  `${minioProtocol}://${environment.server.MINIO_ENDPOINT}:${environment.server.MINIO_PORT}`,
).origin;
const monitoringOrigin = environment.client.NEXT_PUBLIC_SENTRY_DSN
  ? new URL(environment.client.NEXT_PUBLIC_SENTRY_DSN).origin
  : undefined;
const securityHeaders = createSecurityHeaders({
  production: process.env.NODE_ENV === "production",
  mediaOrigin,
  ...(monitoringOrigin ? { monitoringOrigin } : {}),
});

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: [...securityHeaders] }];
  },
  experimental: {
    globalNotFound: true,
    // Keep Next's same-origin Server Action check; no proxy origins bypass it.
    serverActions: { bodySizeLimit: "64kb" },
  },
};

const withNextIntl = createNextIntlPlugin("./src/locales/request.ts");

const sourceMapsEnabled = environment.server.SENTRY_SOURCE_MAPS_ENABLED;
const sentryRelease = environment.server.SENTRY_RELEASE ?? environment.server.DEPLOYMENT_VERSION;

export default withSentryConfig(withNextIntl(nextConfig), {
  ...(environment.server.SENTRY_AUTH_TOKEN
    ? { authToken: environment.server.SENTRY_AUTH_TOKEN }
    : {}),
  ...(environment.server.SENTRY_ORG ? { org: environment.server.SENTRY_ORG } : {}),
  ...(environment.server.SENTRY_PROJECT ? { project: environment.server.SENTRY_PROJECT } : {}),
  ...(sentryRelease ? { release: { name: sentryRelease } } : {}),
  silent: !sourceMapsEnabled,
  sourcemaps: {
    disable: !sourceMapsEnabled,
    deleteSourcemapsAfterUpload: true,
  },
  telemetry: false,
  useRunAfterProductionCompileHook: true,
  widenClientFileUpload: true,
});
