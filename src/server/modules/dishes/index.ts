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
export { countDishesUsingIngredient } from "./repository/ingredient-references";
