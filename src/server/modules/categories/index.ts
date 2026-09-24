/** Public entry point for menu category use cases. */
export const MODULE_NAME = "categories" as const;

export { CATEGORY_STATUSES } from "./model/category";
export type { CategoryRecord, CategoryStatus, CategoryTranslation } from "./model/category";
export {
  CategoryMediaReferenceError,
  validateCategoryMediaReferences,
} from "./validation/category-media";
export { createCategoryRepository, CategoryRepositoryConflictError } from "./repository/category";
export { isPublishedCategorySlug, listPublishedCategoriesForSitemap } from "./repository/sitemap";
export type { CategorySitemapEntry } from "./repository/sitemap";
export type {
  CategoryListOptions,
  CategoryListResult,
  CategoryRepository,
  CategorySnapshot,
  CategoryWrite,
} from "./repository/category";
export { createCategoryServices, CategoryServiceError } from "./service/category-crud";
export type {
  CategoryActor,
  CategoryAuditEvent,
  CategoryInput,
  CategorySeoPort,
  CategoryServiceDependencies,
  CategoryUpdate,
} from "./service/category-crud";
export { createCategoryAuditSink } from "./service/category-audit";
export {
  categoryArchiveSchema,
  categoryCreateSchema,
  categoryIdParametersSchema,
  categoryListQuerySchema,
  categoryUpdateSchema,
} from "./validation/category-request";
