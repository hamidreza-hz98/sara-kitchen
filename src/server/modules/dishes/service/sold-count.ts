import "server-only";

import type { ClientSession, Connection } from "mongoose";

import { deriveSoldCountProjection, type SoldCountOrderSnapshot } from "../policy/sold-count";
import {
  createDishSoldCountRepository,
  type DishSoldCountRepository,
  type SoldCountProjectionResult,
} from "../repository/sold-count";

export type DishSoldCountProjector = Readonly<{
  project(
    snapshot: SoldCountOrderSnapshot,
    session: ClientSession,
  ): Promise<SoldCountProjectionResult>;
}>;

export function createDishSoldCountProjector(
  connection: Connection,
  repository: DishSoldCountRepository = createDishSoldCountRepository(connection),
): DishSoldCountProjector {
  return Object.freeze({
    project(snapshot, session) {
      return repository.apply(deriveSoldCountProjection(snapshot), session);
    },
  });
}
