/** Public entry point for ingredient and allergen use cases. */
export const MODULE_NAME = "ingredients" as const;

export {
  INGREDIENT_ALLERGEN_TAGS,
  INGREDIENT_STATUSES,
  getIngredientModel,
} from "./model/ingredient";
export type {
  IngredientAllergenTag,
  IngredientRecord,
  IngredientStatus,
  IngredientTranslation,
} from "./model/ingredient";
export {
  IngredientMediaReferenceError,
  validateIngredientImageReference,
} from "./validation/ingredient-media";
