import "server-only";

import type { Connection } from "mongoose";

import { getDishModel, type DishRecord } from "../model/dish";
import {
  DISH_PUBLIC_CATALOG_PROJECTION,
  mapDishCatalogRecord,
  type DishCatalogRecord,
} from "./catalog";

export const DISH_RECOMMENDATION_QUERY_MAX_TIME_MS = 250;

export type DishRecommendationSource = Readonly<{
  id: string;
  categoryIds: readonly string[];
  relatedDishIds: readonly string[];
}>;

export type DishRecommendationCandidatePools = Readonly<{
  category: readonly DishCatalogRecord[];
  featured: readonly DishCatalogRecord[];
  related: readonly DishCatalogRecord[];
}>;

export interface DishRecommendationRepository {
  findSources(dishIds: readonly string[]): Promise<readonly DishRecommendationSource[]>;
  findCandidates(input: {
    at: Date;
    categoryIds: readonly string[];
    excludeDishIds: readonly string[];
    poolSize: number;
    relatedDishIds: readonly string[];
  }): Promise<DishRecommendationCandidatePools>;
}

type SourceProjection = Pick<DishRecord, "_id" | "categoryIds" | "relatedDishIds">;

function availableAt(at: Date): Record<string, unknown> {
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

export function createDishRecommendationRepository(
  connection: Connection,
): DishRecommendationRepository {
  const Dish = getDishModel(connection);
  return {
    async findSources(dishIds) {
      const records = await Dish.find(
        { _id: { $in: dishIds }, deletedAt: null, status: "published" },
        { categoryIds: 1, relatedDishIds: 1 },
      )
        .maxTimeMS(DISH_RECOMMENDATION_QUERY_MAX_TIME_MS)
        .lean<SourceProjection[]>();
      const byId = new Map(records.map((record) => [record._id.toHexString(), record]));
      return dishIds.flatMap((id) => {
        const record = byId.get(id);
        return record
          ? [
              {
                id,
                categoryIds: record.categoryIds.map((categoryId) => categoryId.toHexString()),
                relatedDishIds: record.relatedDishIds.map((dishId) => dishId.toHexString()),
              },
            ]
          : [];
      });
    },

    async findCandidates({ at, categoryIds, excludeDishIds, poolSize, relatedDishIds }) {
      const base: Record<string, unknown> = {
        _id: { $nin: excludeDishIds },
        deletedAt: null,
        status: "published",
        ...availableAt(at),
      };
      const query = (filter: Record<string, unknown>) =>
        Dish.find({ ...base, ...filter }, DISH_PUBLIC_CATALOG_PROJECTION)
          .sort({ isFeatured: -1, featuredOrder: 1, _id: 1 })
          .limit(poolSize)
          .maxTimeMS(DISH_RECOMMENDATION_QUERY_MAX_TIME_MS)
          .lean<Parameters<typeof mapDishCatalogRecord>[0][]>();

      const [related, category, featured] = await Promise.all([
        relatedDishIds.length > 0
          ? query({ _id: { $in: relatedDishIds, $nin: excludeDishIds } })
          : [],
        categoryIds.length > 0 ? query({ categoryIds: { $in: categoryIds } }) : [],
        query({ isFeatured: true }),
      ]);
      return {
        related: related.map(mapDishCatalogRecord),
        category: category.map(mapDishCatalogRecord),
        featured: featured.map(mapDishCatalogRecord),
      };
    },
  };
}
