import "server-only";

import { Types } from "mongoose";
import { z } from "zod";

import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale } from "@/constants";
import type { IngredientAllergenCatalog } from "@/server/modules/ingredients";

import type { DishCatalogItem } from "./catalog-query";
import { mapDishCatalogItem } from "./catalog-query";
import type {
  DishRecommendationRepository,
  DishRecommendationSource,
} from "../repository/recommendations";

export const DISH_RECOMMENDATION_DEFAULT_LIMIT = 6;
export const DISH_RECOMMENDATION_MAX_LIMIT = 12;
export const DISH_RECOMMENDATION_MAX_SOURCE_DISHES = 50;
const CANDIDATE_POOL_MULTIPLIER = 3;

export type DishRecommendationReason =
  | Readonly<{ kind: "related"; sourceDishIds: readonly string[] }>
  | Readonly<{
      kind: "category";
      sharedCategoryIds: readonly string[];
      sourceDishIds: readonly string[];
    }>
  | Readonly<{ kind: "featured" }>;

export type DishRecommendationItem = DishCatalogItem &
  Readonly<{ reason: DishRecommendationReason }>;

export type DishRecommendationResult = Readonly<{
  evaluatedAt: string;
  items: readonly DishRecommendationItem[];
  locale: SupportedLocale;
}>;

export type DishRecommendationInput = Readonly<{
  currentDishIds: readonly string[];
  fallbackLocale?: SupportedLocale | null;
  limit?: number;
  locale?: SupportedLocale;
}>;

export type DishRecommendationDependencies = Readonly<{
  ingredients: IngredientAllergenCatalog;
  now?: () => Date;
  repository: DishRecommendationRepository;
}>;

export class DishRecommendationError extends Error {
  constructor(readonly code: "invalid_input" | "invalid_catalog_data") {
    super(code);
    this.name = "DishRecommendationError";
  }
}

const objectId = z
  .string()
  .refine((value) => Types.ObjectId.isValid(value) && /^[a-f\d]{24}$/iu.test(value));
const inputSchema = z.strictObject({
  currentDishIds: z.array(objectId).max(DISH_RECOMMENDATION_MAX_SOURCE_DISHES),
  fallbackLocale: z.enum(SUPPORTED_LOCALES).nullable().optional(),
  limit: z
    .number()
    .int()
    .min(1)
    .max(DISH_RECOMMENDATION_MAX_LIMIT)
    .default(DISH_RECOMMENDATION_DEFAULT_LIMIT),
  locale: z.enum(SUPPORTED_LOCALES).default(DEFAULT_LOCALE),
});

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function relationOrder(sources: readonly DishRecommendationSource[]): Map<string, number> {
  const order = new Map<string, number>();
  for (const source of sources) {
    for (const relatedId of source.relatedDishIds) {
      if (!order.has(relatedId)) order.set(relatedId, order.size);
    }
  }
  return order;
}

function sourceIdsForRelation(
  sources: readonly DishRecommendationSource[],
  candidateId: string,
): string[] {
  return sources
    .filter((source) => source.relatedDishIds.includes(candidateId))
    .map(({ id }) => id);
}

function categoryEvidence(
  sources: readonly DishRecommendationSource[],
  candidateCategoryIds: readonly string[],
) {
  const candidateCategories = new Set(candidateCategoryIds);
  const sourceDishIds: string[] = [];
  const sharedCategoryIds = new Set<string>();
  for (const source of sources) {
    const shared = source.categoryIds.filter((id) => candidateCategories.has(id));
    if (shared.length > 0) sourceDishIds.push(source.id);
    for (const id of shared) sharedCategoryIds.add(id);
  }
  return { sourceDishIds, sharedCategoryIds: [...sharedCategoryIds].sort() };
}

export function createDishRecommendationService(dependencies: DishRecommendationDependencies) {
  return async function recommend(raw: DishRecommendationInput): Promise<DishRecommendationResult> {
    const parsed = inputSchema.safeParse(raw);
    if (
      !parsed.success ||
      new Set(parsed.data.currentDishIds).size !== parsed.data.currentDishIds.length
    ) {
      throw new DishRecommendationError("invalid_input");
    }
    const at = dependencies.now?.() ?? new Date();
    if (!Number.isFinite(at.getTime())) throw new DishRecommendationError("invalid_catalog_data");
    if (parsed.data.currentDishIds.length === 0) {
      return { evaluatedAt: at.toISOString(), items: [], locale: parsed.data.locale };
    }

    const sources = await dependencies.repository.findSources(parsed.data.currentDishIds);
    const relatedIds = unique(sources.flatMap(({ relatedDishIds }) => relatedDishIds));
    const categoryIds = unique(sources.flatMap(({ categoryIds: ids }) => ids));
    const poolSize = parsed.data.limit * CANDIDATE_POOL_MULTIPLIER;
    const pools = await dependencies.repository.findCandidates({
      at,
      categoryIds,
      excludeDishIds: parsed.data.currentDishIds,
      poolSize,
      relatedDishIds: relatedIds.slice(0, poolSize),
    });

    const relationRanks = relationOrder(sources);
    const ranked = new Map<
      string,
      Readonly<{
        rank: readonly number[];
        reason: DishRecommendationReason;
        record: (typeof pools.related)[number];
      }>
    >();
    for (const record of pools.related) {
      const sourceDishIds = sourceIdsForRelation(sources, record.id);
      if (sourceDishIds.length === 0) continue;
      ranked.set(record.id, {
        rank: [0, relationRanks.get(record.id) ?? Number.MAX_SAFE_INTEGER, record.featuredOrder],
        reason: { kind: "related", sourceDishIds },
        record,
      });
    }
    for (const record of pools.category) {
      if (ranked.has(record.id)) continue;
      const evidence = categoryEvidence(sources, record.categoryIds);
      if (evidence.sharedCategoryIds.length === 0) continue;
      ranked.set(record.id, {
        rank: [
          1,
          -evidence.sharedCategoryIds.length,
          -evidence.sourceDishIds.length,
          record.featuredOrder,
        ],
        reason: { kind: "category", ...evidence },
        record,
      });
    }
    for (const record of pools.featured) {
      if (ranked.has(record.id)) continue;
      ranked.set(record.id, {
        rank: [2, record.featuredOrder],
        reason: { kind: "featured" },
        record,
      });
    }

    const selected = [...ranked.values()]
      .sort((left, right) => {
        for (let index = 0; index < Math.max(left.rank.length, right.rank.length); index += 1) {
          const difference = (left.rank[index] ?? 0) - (right.rank[index] ?? 0);
          if (difference !== 0) return difference;
        }
        return left.record.id.localeCompare(right.record.id);
      })
      .slice(0, parsed.data.limit);
    const allergens = await dependencies.ingredients.getAllergensByIngredientIds(
      unique(selected.flatMap(({ record }) => record.ingredientIds)),
    );
    const items = selected.flatMap(({ reason, record }) => {
      try {
        return [
          {
            ...mapDishCatalogItem(record, parsed.data, at, allergens),
            reason,
          },
        ];
      } catch {
        return [];
      }
    });
    return { evaluatedAt: at.toISOString(), items, locale: parsed.data.locale };
  };
}
