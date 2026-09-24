import "server-only";

import { SUPPORTED_LOCALES } from "@/constants";
import { connectToDatabase } from "@/server/database";
import { getApplicationSiteUrl } from "@/server/environment";
import { listPublishedBlogsForSitemap } from "@/server/modules/blogs";
import { listPublishedCategoriesForSitemap } from "@/server/modules/categories";
import { listAvailableDishesForSitemap } from "@/server/modules/dishes";
import { createSitemapEntries, type SitemapEntry } from "@/server/modules/seo";
import { createApplicationLogger } from "@/server/observability";

const logger = createApplicationLogger({ module: "seo" });
const INITIAL_HOMEPAGE_CONTENT_DATE = new Date("2026-09-24T00:00:00.000Z");

function staticEntries() {
  // Only routes with an implemented, successful canonical page belong here. The remaining approved
  // static SEO routes join this list when their storefront pages are implemented.
  return [
    {
      path: "/",
      lastModified: INITIAL_HOMEPAGE_CONTENT_DATE,
      locales: SUPPORTED_LOCALES,
      changeFrequency: "weekly" as const,
      priority: 1,
    },
  ];
}

export async function loadPublicSitemapEntries(at = new Date()): Promise<readonly SitemapEntry[]> {
  const base = staticEntries();
  try {
    const connection = await connectToDatabase();
    const [categories, dishes, blogs] = await Promise.all([
      listPublishedCategoriesForSitemap(connection),
      listAvailableDishesForSitemap(connection, at),
      listPublishedBlogsForSitemap(connection, at),
    ]);
    return createSitemapEntries(getApplicationSiteUrl(), [
      ...base,
      ...categories.map((entry) => ({
        path: `/menu/category/${entry.slug}`,
        lastModified: entry.updatedAt,
        locales: entry.locales,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
      ...dishes.map((entry) => ({
        path: `/menu/${entry.slug}`,
        lastModified: entry.updatedAt,
        locales: entry.locales,
        changeFrequency: "daily" as const,
        priority: 0.8,
      })),
      ...blogs.map((entry) => ({
        path: `/blog/${entry.slug}`,
        lastModified: entry.updatedAt,
        locales: entry.locales,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      })),
    ]);
  } catch (error) {
    logger.error({
      action: "sitemap.dynamic_sources_failed",
      message:
        "Dynamic sitemap sources were unavailable; only verified static routes were emitted.",
      error,
    });
    return createSitemapEntries(getApplicationSiteUrl(), base);
  }
}
