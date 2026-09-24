import { describe, expect, it } from "vitest";

import { createWebManifest } from "@/app/manifest-data";
import { PRIVATE_ROBOTS_PATHS, createRobotsPolicy } from "@/app/robots-policy";

describe("robots policy", () => {
  it("allows public production pages, excludes internals, and advertises the canonical sitemap", () => {
    const policy = createRobotsPolicy(true, "https://sarakitchen.pt/a/path?ignored=true");

    expect(policy).toEqual({
      rules: {
        userAgent: "*",
        allow: "/",
        disallow: [...PRIVATE_ROBOTS_PATHS],
      },
      sitemap: "https://sarakitchen.pt/sitemap.xml",
      host: "https://sarakitchen.pt",
    });
  });

  it("blocks every crawler and advertises no discovery endpoints outside production", () => {
    expect(createRobotsPolicy(false, "http://localhost:3000")).toEqual({
      rules: { userAgent: "*", disallow: "/" },
    });
  });

  it("rejects a non-web canonical origin", () => {
    expect(() => createRobotsPolicy(true, "ftp://sarakitchen.pt")).toThrow(/HTTP or HTTPS/u);
  });
});

describe("web manifest", () => {
  it.each([
    ["en", "ltr", "Persian Homemade Food"],
    ["pt-PT", "ltr", "Comida Persa Caseira"],
    ["fa", "rtl", "غذای خانگی ایرانی"],
  ] as const)("localizes %s copy and direction", (locale, direction, expectedName) => {
    const manifest = createWebManifest(locale);

    expect(manifest.lang).toBe(locale);
    expect(manifest.dir).toBe(direction);
    expect(manifest.name).toContain(expectedName);
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
  });

  it("uses installable brand colors and complete any/maskable icon coverage", () => {
    const manifest = createWebManifest("en");

    expect(manifest.display).toBe("standalone");
    expect(manifest.theme_color).toBe("#FF6161");
    expect(manifest.background_color).toBe("#F8F5F5");
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sizes: "192x192", purpose: "any" }),
        expect.objectContaining({ sizes: "512x512", purpose: "any" }),
        expect.objectContaining({ sizes: "512x512", purpose: "maskable" }),
      ]),
    );
  });
});
