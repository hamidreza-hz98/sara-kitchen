/** Public entry point for menu category use cases. */
export const MODULE_NAME = "categories" as const;

export { CATEGORY_STATUSES } from "./model/category";
export type { CategoryRecord, CategoryStatus, CategoryTranslation } from "./model/category";
export {
  CategoryMediaReferenceError,
  validateCategoryMediaReferences,
} from "./validation/category-media";
