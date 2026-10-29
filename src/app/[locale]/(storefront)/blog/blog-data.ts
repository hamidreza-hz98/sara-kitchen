import "server-only";

import type { SupportedLocale } from "@/constants";
import { resolveLocalizedValue } from "@/locales/translation-selection";
import { connectToDatabase } from "@/server/database";
import { createBlogRepository } from "@/server/modules/blogs";
import { createMediaStorageProvider, resolveStorefrontMediaImage } from "@/server/modules/media";

import { BLOG_PAGE_SIZE, type BlogQuery } from "./blog-query";

export type BlogCard = Readonly<{
  slug: string;
  title: string;
  excerpt: string;
  image: { url: string; alt: string } | null;
  author: string;
  publishedAt: string;
  readTimeMinutes: number;
  tags: readonly string[];
}>;

export type BlogIndexContent = Readonly<{
  items: readonly BlogCard[];
  total: number;
  totalPages: number;
}>;

export async function loadBlogIndex(
  locale: SupportedLocale,
  query: BlogQuery,
): Promise<BlogIndexContent> {
  const connection = await connectToDatabase();
  const result = await createBlogRepository(connection).listPublic({
    page: query.page,
    pageSize: BLOG_PAGE_SIZE,
    ...(query.search ? { search: query.search } : {}),
    sortBy: query.sort === "popular" ? "viewCount" : "publishedAt",
    sortDirection: query.sort === "oldest" ? "asc" : "desc",
  });
  const storage = createMediaStorageProvider();
  const items = await Promise.all(
    result.items.map(async (item) => {
      const title = resolveLocalizedValue(item.translations, "title", locale)?.value ?? item.slug;
      const excerpt = resolveLocalizedValue(item.translations, "excerpt", locale)?.value ?? "";
      let image: BlogCard["image"] = null;
      if (item.imageMediaId) {
        try {
          const found = await resolveStorefrontMediaImage(
            connection,
            storage,
            item.imageMediaId,
            locale,
            "thumbnail",
          );
          if (found) image = { url: found.url, alt: found.alt || title };
        } catch {
          // A missing media variant must not hide a published article.
        }
      }
      return {
        slug: item.slug,
        title,
        excerpt,
        image,
        author: item.authorSnapshot.displayName,
        publishedAt: item.publishedAt ?? "",
        readTimeMinutes: item.readTimeMinutes,
        tags: item.tags,
      };
    }),
  );
  return { items, total: result.total, totalPages: Math.ceil(result.total / BLOG_PAGE_SIZE) };
}
