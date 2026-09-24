import "server-only";

import type { Connection } from "mongoose";

import type { SupportedLocale } from "@/constants";

import { getBlogModel } from "../model/blog";

export type BlogSitemapEntry = Readonly<{
  slug: string;
  locales: readonly SupportedLocale[];
  updatedAt: Date;
}>;

/** Public discovery projection; scheduled, draft, archived, and deleted posts are excluded. */
export async function listPublishedBlogsForSitemap(
  connection: Connection,
  at = new Date(),
): Promise<readonly BlogSitemapEntry[]> {
  const records = await getBlogModel(connection)
    .find({ deletedAt: null, status: "published", publishedAt: { $lte: at } })
    .select({ _id: 0, slug: 1, "translations.locale": 1, updatedAt: 1 })
    .sort({ slug: 1 })
    .lean()
    .exec();
  return records.map((record) => ({
    slug: record.slug,
    locales: record.translations.map((translation) => translation.locale),
    updatedAt: record.updatedAt,
  }));
}

export async function isPublishedBlogSlug(
  connection: Connection,
  slug: string,
  at = new Date(),
): Promise<boolean> {
  return Boolean(
    await getBlogModel(connection).exists({
      slug,
      deletedAt: null,
      status: "published",
      publishedAt: { $lte: at },
    }),
  );
}
