import "server-only";

import { SUPPORTED_LOCALES, type SupportedLocale } from "@/constants";

export const SITEMAP_URL_LIMIT = 45_000;

export type SitemapSourceEntry = Readonly<{
  path: string;
  lastModified: Date;
  locales: readonly SupportedLocale[];
  changeFrequency: "daily" | "weekly" | "monthly";
  priority: number;
}>;

export type SitemapEntry = Readonly<{
  url: string;
  lastModified: string;
  alternates: Readonly<Record<string, string>>;
  changeFrequency: SitemapSourceEntry["changeFrequency"];
  priority: number;
}>;

function normalizedSiteUrl(value: string): URL {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new TypeError("Sitemap site URL must be a credential-free HTTP(S) URL.");
  }
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url;
}

function validLastModified(value: Date): string {
  if (!Number.isFinite(value.getTime()))
    throw new TypeError("Sitemap last-modified must be valid.");
  return value.toISOString();
}

function languageAlternates(url: string, locales: readonly SupportedLocale[]) {
  const unique = SUPPORTED_LOCALES.filter((locale) => locales.includes(locale));
  return Object.fromEntries([...unique.map((locale) => [locale, url]), ["x-default", url]]);
}

export function createSitemapEntries(
  siteUrl: string,
  sources: readonly SitemapSourceEntry[],
): readonly SitemapEntry[] {
  const base = normalizedSiteUrl(siteUrl);
  const byUrl = new Map<string, SitemapEntry>();
  for (const source of sources) {
    const resolved = new URL(source.path, base);
    const url = resolved.pathname === "/" ? resolved.origin : resolved.toString();
    if (byUrl.has(url)) throw new TypeError(`Duplicate sitemap URL: ${url}`);
    if (source.priority < 0 || source.priority > 1) {
      throw new TypeError("Sitemap priority must be from zero through one.");
    }
    byUrl.set(url, {
      url,
      lastModified: validLastModified(source.lastModified),
      alternates: languageAlternates(url, source.locales),
      changeFrequency: source.changeFrequency,
      priority: source.priority,
    });
  }
  return [...byUrl.values()].sort((left, right) => left.url.localeCompare(right.url, "en"));
}

export function sitemapShardCount(entryCount: number, limit = SITEMAP_URL_LIMIT): number {
  if (!Number.isSafeInteger(entryCount) || entryCount < 0)
    throw new TypeError("Invalid entry count.");
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50_000) {
    throw new TypeError("Sitemap shard limit must be between one and 50,000.");
  }
  return Math.max(1, Math.ceil(entryCount / limit));
}

export function selectSitemapShard(
  entries: readonly SitemapEntry[],
  shard: number,
  limit = SITEMAP_URL_LIMIT,
): readonly SitemapEntry[] | null {
  const count = sitemapShardCount(entries.length, limit);
  if (!Number.isSafeInteger(shard) || shard < 0 || shard >= count) return null;
  return entries.slice(shard * limit, (shard + 1) * limit);
}

function xml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function renderSitemapXml(entries: readonly SitemapEntry[]): string {
  const body = entries
    .map((entry) => {
      const alternates = Object.entries(entry.alternates)
        .map(
          ([locale, href]) =>
            `<xhtml:link rel="alternate" hreflang="${xml(locale)}" href="${xml(href)}"/>`,
        )
        .join("");
      return `<url><loc>${xml(entry.url)}</loc><lastmod>${entry.lastModified}</lastmod><changefreq>${entry.changeFrequency}</changefreq><priority>${entry.priority.toFixed(1)}</priority>${alternates}</url>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${body}</urlset>`;
}

export function renderSitemapIndexXml(siteUrl: string, shardCount: number): string {
  const base = normalizedSiteUrl(siteUrl);
  if (!Number.isSafeInteger(shardCount) || shardCount < 1)
    throw new TypeError("Invalid shard count.");
  const body = Array.from(
    { length: shardCount },
    (_, shard) =>
      `<sitemap><loc>${xml(new URL(`/sitemaps/${shard}.xml`, base).toString())}</loc></sitemap>`,
  ).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</sitemapindex>`;
}
