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
export { dishViewReceiptSchema, getDishViewReceiptModel } from "./model/dish-view-receipt";
export type { DishViewReceiptRecord } from "./model/dish-view-receipt";
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
export { createDishViewRepository } from "./repository/dish-view";
export type { DishViewPersistenceResult, DishViewRepository } from "./repository/dish-view";
export { createDishCatalogRepository } from "./repository/catalog";
export type {
  DishCatalogQueryPlan,
  DishCatalogRecord,
  DishCatalogRepository,
  DishCatalogRepositoryResult,
} from "./repository/catalog";
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
export {
  DISH_CATALOG_AVAILABILITY_FILTERS,
  DISH_CATALOG_SORTS,
  DISH_CATALOG_VIEW_MODES,
  DishCatalogQueryError,
  createDishCatalogService,
} from "./service/catalog-query";
export {
  DISH_VIEW_DEDUPLICATION_WINDOW_MS,
  DISH_VIEW_MINIMUM_ENGAGEMENT_MS,
  DISH_VIEW_RECEIPT_RETENTION_MS,
  DISH_VIEW_USER_AGENT_MAX_LENGTH,
  evaluateDishViewSignal,
} from "./policy/dish-view";
export type { DishViewCandidate, DishViewDecision, DishViewSignal } from "./policy/dish-view";
export { createDishViewCounter } from "./service/dish-view";
export type {
  DishViewCounterDependencies,
  DishViewQueueResult,
  DishViewWorkScheduler,
} from "./service/dish-view";
export type {
  DishCatalogAvailabilityFilter,
  DishCatalogDependencies,
  DishCatalogItem,
  DishCatalogLocalizedText,
  DishCatalogQueryInput,
  DishCatalogResult,
  DishCatalogSort,
  DishCatalogViewMode,
} from "./service/catalog-query";
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
