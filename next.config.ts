import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import { validateEnvironment } from "./src/server/environment-core";

validateEnvironment();

const nextConfig: NextConfig = {
  experimental: {
    globalNotFound: true,
    // Keep Next's same-origin Server Action check; no proxy origins bypass it.
    serverActions: { bodySizeLimit: "64kb" },
  },
};

const withNextIntl = createNextIntlPlugin("./src/locales/request.ts");

export default withNextIntl(nextConfig);
