import type { NextConfig } from "next";

import { validateEnvironment } from "./src/server/environment-core";

validateEnvironment();

const nextConfig: NextConfig = {};

export default nextConfig;
