import "server-only";

import type { Connection, QueryFilter } from "mongoose";

import type { SupportedLocale } from "@/constants";

import { getDishModel, type DishRecord } from "../model/dish";

export type DishSitemapEntry = Readonly<{
  slug: string;
  locales: readonly SupportedLocale[];
  updatedAt: Date;
}>;

function availableFilter(at: Date): QueryFilter<DishRecord> {
  return {
    $or: [
      { "availability.mode": "available" },
      {
        "availability.mode": "scheduled",
        $and: [
          {
            $or: [
              { "availability.availableFrom": null },
              { "availability.availableFrom": { $lte: at } },
            ],
          },
          {
            $or: [
              { "availability.availableUntil": null },
              { "availability.availableUntil": { $gt: at } },
            ],
          },
        ],
      },
    ],
  };
}

/** Public discovery projection with the same time-aware availability contract as the catalog. */
export async function listAvailableDishesForSitemap(
  connection: Connection,
  at = new Date(),
): Promise<readonly DishSitemapEntry[]> {
  const records = await getDishModel(connection)
    .find({
      deletedAt: null,
      status: "published",
      ...availableFilter(at),
    })
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

export async function isAvailableDishSlug(
  connection: Connection,
  slug: string,
  at = new Date(),
): Promise<boolean> {
  return Boolean(
    await getDishModel(connection).exists({
      slug,
      deletedAt: null,
      status: "published",
      ...availableFilter(at),
    }),
  );
}
