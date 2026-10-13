import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createCartRecommendationLoader } from "@/server/modules/carts/service/cart-recommendations";
import type { DishRecommendationResult } from "@/server/modules/dishes";

const input = { currentDishIds: ["1".repeat(24)], locale: "fa" as const };
const successful: DishRecommendationResult = {
  evaluatedAt: "2026-10-13T12:00:00.000Z",
  items: [],
  locale: "fa",
};

describe("cart recommendation fail-open loader", () => {
  it("returns successful optional enrichment without changing its payload", async () => {
    const load = vi.fn(async () => successful);
    const result = await createCartRecommendationLoader({ load, timeBudgetMs: 50 })(input);
    expect(result).toEqual({ ...successful, degraded: false });
    expect(load).toHaveBeenCalledWith(input);
  });

  it("returns a bounded empty result when catalog loading fails", async () => {
    const result = await createCartRecommendationLoader({
      load: async () => {
        throw new Error("database unavailable");
      },
      timeBudgetMs: 50,
    })(input);
    expect(result).toEqual({
      degraded: true,
      evaluatedAt: "1970-01-01T00:00:00.000Z",
      items: [],
      locale: "fa",
    });
  });

  it("times out slow optional work so cart rendering can continue", async () => {
    vi.useFakeTimers();
    try {
      const resultPromise = createCartRecommendationLoader({
        load: () => new Promise(() => undefined),
        timeBudgetMs: 25,
      })(input);
      await vi.advanceTimersByTimeAsync(25);
      await expect(resultPromise).resolves.toMatchObject({ degraded: true, items: [] });
    } finally {
      vi.useRealTimers();
    }
  });

  it("fails open for an invalid time budget", async () => {
    const load = vi.fn(async () => successful);
    await expect(
      createCartRecommendationLoader({ load, timeBudgetMs: 0 })(input),
    ).resolves.toMatchObject({ degraded: true, items: [] });
    expect(load).not.toHaveBeenCalled();
  });
});
