import "server-only";

import { Types } from "mongoose";
import type { Connection } from "mongoose";

/** Public reference check owned by Dishes; Ingredients never access a Dish model or schema. */
export async function countDishesUsingIngredient(
  connection: Connection,
  ingredientId: string,
): Promise<number> {
  if (!Types.ObjectId.isValid(ingredientId)) return 0;
  const id = new Types.ObjectId(ingredientId);
  return connection.collection("dishes").countDocuments({
    deletedAt: null,
    $or: [{ ingredientIds: id }, { "ingredients.ingredientId": id }],
  });
}
