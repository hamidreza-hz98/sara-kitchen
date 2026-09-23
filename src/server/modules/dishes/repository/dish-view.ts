import "server-only";

import { Types } from "mongoose";
import type { Connection } from "mongoose";

import { getDishModel } from "../model/dish";
import { getDishViewReceiptModel } from "../model/dish-view-receipt";
import type { DishViewCandidate } from "../policy/dish-view";

export type DishViewPersistenceResult = "counted" | "duplicate" | "dish_unavailable";

export interface DishViewRepository {
  count(candidate: DishViewCandidate): Promise<DishViewPersistenceResult>;
}

/**
 * Claim the dedupe window before incrementing. If the increment fails or the dish is not public,
 * remove the claim so a later legitimate signal can retry. This operation is deliberately best
 * effort; view counts are analytics rather than transactional truth.
 */
export function createDishViewRepository(connection: Connection): DishViewRepository {
  const Dish = getDishModel(connection);
  const Receipt = getDishViewReceiptModel(connection);
  return {
    async count(candidate) {
      const dishId = new Types.ObjectId(candidate.dishId);
      let claim;
      try {
        claim = await Receipt.updateOne(
          {
            dishId,
            visitorHash: candidate.visitorHash,
            windowStartedAt: candidate.windowStartedAt,
          },
          {
            $setOnInsert: {
              dishId,
              visitorHash: candidate.visitorHash,
              windowStartedAt: candidate.windowStartedAt,
              expiresAt: candidate.expiresAt,
            },
          },
          { upsert: true },
        );
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === 11_000
        ) {
          return "duplicate";
        }
        throw error;
      }
      if (claim.upsertedCount !== 1) return "duplicate";

      const receiptFilter = {
        dishId,
        visitorHash: candidate.visitorHash,
        windowStartedAt: candidate.windowStartedAt,
      };
      try {
        const update = await Dish.updateOne(
          {
            _id: dishId,
            deletedAt: null,
            status: "published",
            viewCount: { $lt: Number.MAX_SAFE_INTEGER },
          },
          { $inc: { viewCount: 1 } },
        );
        if (update.modifiedCount === 1) return "counted";
        await Receipt.deleteOne(receiptFilter);
        return "dish_unavailable";
      } catch (error) {
        await Receipt.deleteOne(receiptFilter).catch(() => undefined);
        throw error;
      }
    },
  };
}
