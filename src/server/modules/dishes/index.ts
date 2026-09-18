/** Public entry point for dish catalog and pricing-source use cases. */
export const MODULE_NAME = "dishes" as const;

export { countDishesUsingIngredient } from "./repository/ingredient-references";
