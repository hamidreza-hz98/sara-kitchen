/** Public entry point for dish catalog and pricing-source use cases. */
export const MODULE_NAME = "dishes" as const;

export {
  DISH_AVAILABILITY_MODES,
  DISH_DEFAULT_MAX_QUANTITY_PER_ORDER,
  DISH_DIETARY_TAGS,
  DISH_DISCOUNT_TYPES,
  DISH_INGREDIENT_QUANTITY_UNITS,
  DISH_MAX_LEAD_TIME_MINUTES,
  DISH_MAX_QUANTITY_PER_ORDER,
  DISH_PORTION_UNITS,
  DISH_STATUSES,
  dishSchema,
  getDishModel,
} from "./model/dish";
export type {
  DishAvailability,
  DishAvailabilityMode,
  DishDietaryTag,
  DishDiscount,
  DishDiscountType,
  DishIngredientNote,
  DishIngredientQuantityUnit,
  DishIngredientReference,
  DishPortionUnit,
  DishRecord,
  DishRichTextDocument,
  DishSpecification,
  DishStatus,
  DishTranslation,
} from "./model/dish";
export {
  DISH_PERCENTAGE_BASIS_POINTS,
  DISH_PRICE_CURRENCY,
  DISH_PRICING_ERROR_CODES,
  DishPricingError,
  calculateDishPrice,
  validateDishPricingDefinition,
} from "./pricing/dish-pricing";
export type {
  CalculateDishPriceInput,
  DishDiscountMetadata,
  DishDiscountState,
  DishPriceBadge,
  DishPriceResult,
  DishPricingErrorCode,
  DishPricingIssue,
} from "./pricing/dish-pricing";
export { countDishesUsingIngredient } from "./repository/ingredient-references";
export { DishRepositoryConflictError, createDishRepository } from "./repository/dish";
export type {
  DishIngredientSnapshot,
  DishListOptions,
  DishListResult,
  DishRepository,
  DishSnapshot,
  DishWrite,
} from "./repository/dish";
export { createDishAuditSink } from "./service/dish-audit";
export {
  DISH_REFERENCE_KINDS,
  DISH_SERVICE_ERROR_CODES,
  DishServiceError,
  createDishServices,
} from "./service/dish-crud";
export type {
  DishAction,
  DishActor,
  DishAuditEvent,
  DishInput,
  DishReferenceInspection,
  DishReferenceIssue,
  DishReferenceKind,
  DishReferenceSet,
  DishSeoPort,
  DishServiceDependencies,
  DishServiceErrorCode,
  DishUpdate,
} from "./service/dish-crud";
