import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createSitemapEntries,
  renderSitemapIndexXml,
  renderSitemapXml,
  selectSitemapShard,
  sitemapShardCount,
} from "@/server/modules/seo";

const modified = new Date("2026-09-24T10:00:00.000Z");

describe("sitemap generation", () => {
  it("creates stable canonical URLs with same-URL locale alternates and last-modified", () => {
    const entries = createSitemapEntries("https://sarakitchen.pt", [
      {
        path: "/menu/fesenjan",
        lastModified: modified,
        locales: ["en", "pt-PT", "fa"],
        changeFrequency: "daily",
        priority: 0.8,
      },
    ]);
    expect(entries).toEqual([
      {
        url: "https://sarakitchen.pt/menu/fesenjan",
        lastModified: modified.toISOString(),
        alternates: {
          en: "https://sarakitchen.pt/menu/fesenjan",
          "pt-PT": "https://sarakitchen.pt/menu/fesenjan",
          fa: "https://sarakitchen.pt/menu/fesenjan",
          "x-default": "https://sarakitchen.pt/menu/fesenjan",
        },
        changeFrequency: "daily",
        priority: 0.8,
      },
    ]);
  });

  it("renders escaped protocol-valid XML including xhtml alternates", () => {
    const entries = createSitemapEntries("https://sarakitchen.pt", [
      {
        path: "/blog/persian-food",
        lastModified: modified,
        locales: ["en", "fa"],
        changeFrequency: "weekly",
        priority: 0.6,
      },
    ]);
    const output = renderSitemapXml(entries);
    expect(output).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    expect(output).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
    expect(output).toContain("<lastmod>2026-09-24T10:00:00.000Z</lastmod>");
    expect(output).toContain('hreflang="fa"');
    expect(output).not.toContain("/en/");
  });

  it("splits deterministically below the protocol limit and rejects invalid shards", () => {
    const entries = createSitemapEntries(
      "https://sarakitchen.pt",
      Array.from({ length: 5 }, (_, index) => ({
        path: `/blog/article-${index}`,
        lastModified: modified,
        locales: ["en" as const],
        changeFrequency: "monthly" as const,
        priority: 0.5,
      })),
    );
    expect(sitemapShardCount(entries.length, 2)).toBe(3);
    expect(selectSitemapShard(entries, 0, 2)).toHaveLength(2);
    expect(selectSitemapShard(entries, 2, 2)).toHaveLength(1);
    expect(selectSitemapShard(entries, 3, 2)).toBeNull();
    expect(renderSitemapIndexXml("https://sarakitchen.pt", 3)).toContain(
      "https://sarakitchen.pt/sitemaps/2.xml",
    );
  });

  it("rejects duplicate URLs, invalid dates, priorities, and unsafe site URLs", () => {
    const source = {
      path: "/",
      lastModified: modified,
      locales: ["en" as const],
      changeFrequency: "weekly" as const,
      priority: 1,
    };
    expect(() => createSitemapEntries("https://sarakitchen.pt", [source, source])).toThrow(
      /Duplicate/u,
    );
    expect(() =>
      createSitemapEntries("https://sarakitchen.pt", [
        { ...source, lastModified: new Date("invalid") },
      ]),
    ).toThrow(/last-modified/u);
    expect(() =>
      createSitemapEntries("https://sarakitchen.pt", [{ ...source, priority: 2 }]),
    ).toThrow(/priority/u);
    expect(() => createSitemapEntries("ftp://example.test", [source])).toThrow(/HTTP/u);
  });
});
