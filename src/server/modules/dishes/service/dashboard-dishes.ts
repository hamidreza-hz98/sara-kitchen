import "server-only";

import type { Connection } from "mongoose";

import type { SupportedLocale } from "@/constants";
import { resolveLocalizedValue } from "@/locales/translation-selection";

import { getDishModel } from "../model/dish";
import { getDishViewReceiptModel } from "../model/dish-view-receipt";

export async function readDashboardDishes(
  connection: Connection,
  period: Readonly<{ start: Date; end: Date }>,
  asOf: Date,
  locale: SupportedLocale,
) {
  const Dish = getDishModel(connection);
  const [published, visited, viewCount] = await Promise.all([
    Dish.countDocuments({ deletedAt: null, status: "published" }),
    Dish.find({ deletedAt: null, status: "published" }, { slug: 1, translations: 1, viewCount: 1 })
      .sort({ viewCount: -1, _id: 1 })

      .limit(5)
      .lean(),
    period.start.getTime() >= asOf.getTime() - 42 * 60 * 60_000
      ? getDishViewReceiptModel(connection).countDocuments({
          createdAt: { $gte: period.start, $lt: period.end },
        })
      : Promise.resolve(null),
  ]);
  return {
    published,
    meaningfulViews: viewCount,
    mostVisitedLifetime: visited.map((row) => ({
      dishId: row._id.toString(),
      slug: row.slug,
      name: resolveLocalizedValue(row.translations, "name", locale)?.value ?? row.slug,
      views: row.viewCount,
    })),
  };
}
