import "server-only";

import type { SupportedLocale } from "@/constants";
import type {
  DishRecommendationInput,
  DishRecommendationItem,
  DishRecommendationResult,
} from "@/server/modules/dishes";

export const CART_RECOMMENDATION_TIME_BUDGET_MS = 400;

export type CartRecommendationResult = DishRecommendationResult & Readonly<{ degraded: boolean }>;

export type CartRecommendationDependencies = Readonly<{
  load(input: DishRecommendationInput): Promise<DishRecommendationResult>;
  timeBudgetMs?: number;
}>;

function empty(locale: SupportedLocale): CartRecommendationResult {
  return {
    degraded: true,
    evaluatedAt: new Date(0).toISOString(),
    items: [] as readonly DishRecommendationItem[],
    locale,
  };
}

/** Optional cart enrichment: it deliberately fails open and is never awaited by cart CRUD. */
export function createCartRecommendationLoader(dependencies: CartRecommendationDependencies) {
  return async function loadCartRecommendations(
    input: DishRecommendationInput,
  ): Promise<CartRecommendationResult> {
    const locale = input.locale ?? "en";
    const budget = dependencies.timeBudgetMs ?? CART_RECOMMENDATION_TIME_BUDGET_MS;
    if (!Number.isSafeInteger(budget) || budget < 1 || budget > 2_000) return empty(locale);

    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeoutResult = new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error("recommendation_timeout")), budget);
      });
      const result = await Promise.race([dependencies.load(input), timeoutResult]);
      return { ...result, degraded: false };
    } catch {
      return empty(locale);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  };
}
