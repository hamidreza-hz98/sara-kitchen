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
export {
  createIngredientRepository,
  IngredientRepositoryConflictError,
} from "./repository/ingredient";
export type {
  IngredientListOptions,
  IngredientListResult,
  IngredientRepository,
  IngredientSnapshot,
  IngredientWrite,
} from "./repository/ingredient";
export { createIngredientServices, IngredientServiceError } from "./service/ingredient-crud";
export type {
  IngredientAction,
  IngredientActor,
  IngredientAuditEvent,
  IngredientInput,
  IngredientServiceDependencies,
  IngredientUpdate,
} from "./service/ingredient-crud";
export { createIngredientAuditSink } from "./service/ingredient-audit";
export {
  ingredientCreateSchema,
  ingredientEmptyMutationSchema,
  ingredientIdParametersSchema,
  ingredientListQuerySchema,
  ingredientUpdateSchema,
} from "./validation/ingredient-request";
