import "server-only";

import { Types } from "mongoose";
import type { ClientSession, Connection } from "mongoose";

import { getDishModel } from "../model/dish";
import { getDishSoldProjectionModel } from "../model/dish-sold-projection";
import type { NormalizedSoldCountProjection } from "../policy/sold-count";

export type SoldCountProjectionStatus = "changed" | "duplicate" | "stale";

export type SoldCountDelta = Readonly<{
  dishId: string;
  delta: number;
}>;

export type SoldCountProjectionResult = Readonly<{
  status: SoldCountProjectionStatus;
  revision: number;
  deltas: readonly SoldCountDelta[];
}>;

export class SoldCountProjectionError extends Error {
  constructor(
    readonly code:
      "transaction_required" | "revision_conflict" | "dish_not_found" | "counter_out_of_range",
    message: string,
  ) {
    super(message);
    this.name = "SoldCountProjectionError";
  }
}

export interface DishSoldCountRepository {
  apply(
    projection: NormalizedSoldCountProjection,
    session: ClientSession,
  ): Promise<SoldCountProjectionResult>;
}

function toQuantityMap(
  values: readonly Readonly<{ dishId: string | Types.ObjectId; quantity: number }>[],
) {
  return new Map(values.map(({ dishId, quantity }) => [dishId.toString(), quantity]));
}

export function createDishSoldCountRepository(connection: Connection): DishSoldCountRepository {
  const Dish = getDishModel(connection);
  const Projection = getDishSoldProjectionModel(connection);

  return {
    async apply(projection, session) {
      if (!session.inTransaction()) {
        throw new SoldCountProjectionError(
          "transaction_required",
          "Sold counts must be projected inside the owning order transaction.",
        );
      }

      const orderId = new Types.ObjectId(projection.orderId);
      const current = await Projection.findOne({ orderId })
        .select("+sourceFingerprint")
        .session(session);
      if (current && projection.revision < current.sourceRevision) {
        return Object.freeze({ status: "stale", revision: current.sourceRevision, deltas: [] });
      }
      if (current && projection.revision === current.sourceRevision) {
        if (current.sourceFingerprint !== projection.fingerprint) {
          throw new SoldCountProjectionError(
            "revision_conflict",
            "The same order revision cannot describe two different sold-count snapshots.",
          );
        }
        return Object.freeze({ status: "duplicate", revision: current.sourceRevision, deltas: [] });
      }

      const previous = toQuantityMap(current?.contributions ?? []);
      const desired = toQuantityMap(projection.contributions);
      const dishIds = new Set([...previous.keys(), ...desired.keys()]);
      const deltas = [...dishIds]
        .map((dishId) => ({
          dishId,
          delta: (desired.get(dishId) ?? 0) - (previous.get(dishId) ?? 0),
        }))
        .filter(({ delta }) => delta !== 0)
        .sort((left, right) => left.dishId.localeCompare(right.dishId));

      for (const { dishId, delta } of deltas) {
        const rangeFilter =
          delta > 0 ? { $lte: Number.MAX_SAFE_INTEGER - delta } : { $gte: Math.abs(delta) };
        const result = await Dish.updateOne(
          { _id: new Types.ObjectId(dishId), soldCount: rangeFilter },
          { $inc: { soldCount: delta } },
          { session },
        );
        if (result.matchedCount !== 1) {
          const exists = await Dish.exists({ _id: new Types.ObjectId(dishId) }).session(session);
          throw new SoldCountProjectionError(
            exists ? "counter_out_of_range" : "dish_not_found",
            exists
              ? "Applying the order would move a dish sold count outside its safe range."
              : "An order references a dish that no longer exists.",
          );
        }
      }

      const persisted = {
        sourceRevision: projection.revision,
        sourceFingerprint: projection.fingerprint,
        fulfillmentState: projection.fulfillmentState,
        paymentState: projection.paymentState,
        contributions: projection.contributions.map(({ dishId, quantity }) => ({
          dishId: new Types.ObjectId(dishId),
          quantity,
        })),
      };
      if (current) {
        current.set(persisted);
        await current.save({ session });
      } else {
        await new Projection({ orderId, ...persisted }).save({ session });
      }

      return Object.freeze({
        status: "changed",
        revision: projection.revision,
        deltas: Object.freeze(deltas),
      });
    },
  };
}
