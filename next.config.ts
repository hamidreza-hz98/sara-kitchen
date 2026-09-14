import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import { validateEnvironment } from "./src/server/environment-core";

validateEnvironment();

const nextConfig: NextConfig = {};

const withNextIntl = createNextIntlPlugin("./src/locales/request.ts");

export default withNextIntl(nextConfig);
