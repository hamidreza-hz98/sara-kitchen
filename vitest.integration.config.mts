import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["tests/{integration,contract}/**/*.{test,spec}.{ts,tsx}"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
