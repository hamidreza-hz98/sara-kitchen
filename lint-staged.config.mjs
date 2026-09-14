import { defineConfig } from "lint-staged/config";

export default defineConfig({
  "*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}": [
    "eslint --fix --max-warnings=0",
    "prettier --write --ignore-unknown",
  ],
  "*.{json,jsonc,yaml,yml,md,mdx,css,scss,html}": "prettier --write --ignore-unknown",
});
