import "server-only";

import type { Connection } from "mongoose";

import type { SupportedLocale } from "@/constants";

import { getCategoryModel } from "../model/category";

export type CategorySitemapEntry = Readonly<{
  slug: string;
  locales: readonly SupportedLocale[];
  updatedAt: Date;
}>;

/** Public discovery projection; drafts, archives, and soft-deleted categories never leave the module. */
export async function listPublishedCategoriesForSitemap(
  connection: Connection,
): Promise<readonly CategorySitemapEntry[]> {
  const records = await getCategoryModel(connection)
    .find({ deletedAt: null, status: "published" })
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

export async function isPublishedCategorySlug(
  connection: Connection,
  slug: string,
): Promise<boolean> {
  return Boolean(
    await getCategoryModel(connection).exists({ slug, deletedAt: null, status: "published" }),
  );
}
