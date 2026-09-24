import "server-only";

import { Types } from "mongoose";
import type { Connection } from "mongoose";

/** Public reference query used by Category lifecycle orchestration. */
export async function countDishesUsingCategory(
  connection: Connection,
  categoryId: string,
): Promise<number> {
  if (!Types.ObjectId.isValid(categoryId)) return 0;
  return connection.collection("dishes").countDocuments({
    deletedAt: null,
    categoryIds: new Types.ObjectId(categoryId),
  });
}
