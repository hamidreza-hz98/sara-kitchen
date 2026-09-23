import "server-only";

import type { ApplicationLogger } from "@/server/observability";

import { evaluateDishViewSignal, type DishViewSignal } from "../policy/dish-view";
import type { DishViewRepository } from "../repository/dish-view";

export type DishViewWorkScheduler = (work: () => Promise<void>) => void;
export type DishViewQueueResult = "scheduled" | "ignored";

export type DishViewCounterDependencies = Readonly<{
  repository: DishViewRepository;
  schedule: DishViewWorkScheduler;
  secret: string;
  logger?: Pick<ApplicationLogger, "error">;
  now?: () => Date;
}>;

/**
 * Validate synchronously, then hand persistence to the platform's post-response scheduler. The
 * scheduled callback catches every failure so analytics can never reject or delay page rendering.
 */
export function createDishViewCounter(dependencies: DishViewCounterDependencies) {
  return {
    queue(signal: DishViewSignal): DishViewQueueResult {
      const decision = evaluateDishViewSignal(signal, {
        secret: dependencies.secret,
        ...(dependencies.now ? { at: dependencies.now() } : {}),
      });
      if (!decision.countable) return "ignored";
      const candidate = decision.candidate;
      dependencies.schedule(async () => {
        try {
          await dependencies.repository.count(candidate);
        } catch (error) {
          dependencies.logger?.error({
            action: "dish-view.count.failed",
            error,
            message: "Dish view count update failed.",
            context: { dishId: candidate.dishId },
          });
        }
      });
      return "scheduled";
    },
  };
}
