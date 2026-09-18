import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["tests/{integration,contract}/**/*.{test,spec}.{ts,tsx}"],
    // MongoMemoryServer and native crypto/image dependencies can exhaust Windows
    // process resources when Vitest starts one fork per test file.
    maxWorkers: 4,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
