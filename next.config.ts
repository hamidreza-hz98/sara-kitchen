import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import { validateEnvironment } from "./src/server/environment-core";
import { createSecurityHeaders } from "./src/server/security/response-headers";

const environment = validateEnvironment();
const minioProtocol = environment.server.MINIO_USE_SSL ? "https" : "http";
const mediaOrigin = new URL(
  `${minioProtocol}://${environment.server.MINIO_ENDPOINT}:${environment.server.MINIO_PORT}`,
).origin;
const securityHeaders = createSecurityHeaders({
  production: process.env.NODE_ENV === "production",
  mediaOrigin,
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

export default withNextIntl(nextConfig);
