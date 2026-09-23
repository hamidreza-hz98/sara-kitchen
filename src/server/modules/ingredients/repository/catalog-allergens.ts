import "server-only";

import { Types } from "mongoose";
import type { Connection } from "mongoose";

import { getIngredientModel, type IngredientAllergenTag } from "../model/ingredient";

export type IngredientAllergenMap = Readonly<Record<string, readonly IngredientAllergenTag[]>>;

export interface IngredientAllergenCatalog {
  findIngredientIdsContainingAny(
    allergens: readonly IngredientAllergenTag[],
  ): Promise<readonly string[]>;
  getAllergensByIngredientIds(ingredientIds: readonly string[]): Promise<IngredientAllergenMap>;
}

/** Public read adapter used by catalog modules without exposing Ingredient documents or models. */
export function createIngredientAllergenCatalog(connection: Connection): IngredientAllergenCatalog {
  const Ingredient = getIngredientModel(connection);
  return {
    async findIngredientIdsContainingAny(allergens) {
      if (allergens.length === 0) return [];
      const records = await Ingredient.find(
        { deletedAt: null, status: "published", allergenTags: { $in: allergens } },
        { _id: 1 },
      ).lean<Pick<InstanceType<typeof Ingredient>, "_id">[]>();
      return records.map((record) => record._id.toHexString());
    },
    async getAllergensByIngredientIds(ingredientIds) {
      const validIds = [...new Set(ingredientIds)]
        .filter((id) => Types.ObjectId.isValid(id))
        .map((id) => new Types.ObjectId(id));
      if (validIds.length === 0) return {};
      const records = await Ingredient.find(
        { _id: { $in: validIds }, deletedAt: null, status: "published" },
        { _id: 1, allergenTags: 1 },
      ).lean<Pick<InstanceType<typeof Ingredient>, "_id" | "allergenTags">[]>();
      return Object.fromEntries(
        records.map((record) => [record._id.toHexString(), [...record.allergenTags]]),
      );
    },
  };
}
