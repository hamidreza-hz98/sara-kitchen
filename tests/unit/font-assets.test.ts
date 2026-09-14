// @vitest-environment node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const fontDirectory = path.join(process.cwd(), "src", "theme", "fonts");
const expectedAssets = {
  "plus-jakarta-sans-latin-variable.woff2":
    "49c62cf1fb70f225ea113361f0134a48858c3a7d0175173aa3e38a0c6c8539d2",
  "vazirmatn-persian-variable.woff2":
    "4e3fa217d38fdafc1fea4414ceb58ca5e662cf0ab5fa735a8c8c20e8b42cad92",
} as const;

describe("local font assets", () => {
  it.each(Object.entries(expectedAssets))(
    "pins %s to its reviewed checksum",
    async (name, hash) => {
      const contents = await readFile(path.join(fontDirectory, name));
      expect(createHash("sha256").update(contents).digest("hex")).toBe(hash);
    },
  );

  it.each(["OFL-Plus-Jakarta-Sans.txt", "OFL-Vazirmatn.txt"])(
    "keeps the SIL license for %s beside the binary",
    async (name) => {
      const license = await readFile(path.join(fontDirectory, name), "utf8");
      expect(license).toContain("SIL OPEN FONT LICENSE Version 1.1");
    },
  );

  it("loads both families through next/font/local", async () => {
    const definition = await readFile(
      path.join(process.cwd(), "src", "theme", "fonts.server.ts"),
      "utf8",
    );

    expect(definition).toContain('from "next/font/local"');
    expect(definition).toContain("plus-jakarta-sans-latin-variable.woff2");
    expect(definition).toContain("vazirmatn-persian-variable.woff2");
    expect(definition).not.toContain("next/font/google");
  });
});
