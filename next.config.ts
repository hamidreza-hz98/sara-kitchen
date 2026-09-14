import type { NextConfig } from "next";

import { validateEnvironment } from "./src/validations/env/server";

validateEnvironment();

const nextConfig: NextConfig = {};

export default nextConfig;
