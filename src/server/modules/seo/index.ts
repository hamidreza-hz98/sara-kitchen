/** Public entry point for metadata and search-discovery use cases. */
export const MODULE_NAME = "seo" as const;

export {
  SEO_ENTITY_KINDS,
  SEO_IMAGE_PREVIEW_VALUES,
  SEO_MAX_KEYWORDS,
  SEO_MAX_STRUCTURED_DATA_BYTES,
  SEO_MAX_STRUCTURED_DATA_DEPTH,
  SEO_MANUAL_ROOT_FIELDS,
  SEO_MANUAL_TRANSLATION_FIELDS,
  SEO_OPEN_GRAPH_TYPES,
  SEO_STRUCTURED_DATA_TYPES,
  SEO_TARGET_TYPES,
  SEO_TWITTER_CARD_TYPES,
  getPageSeoModel,
  isNormalizedSeoPath,
  isSafeCanonicalUrl,
  isSafeStructuredDataInputs,
  pageSeoSchema,
} from "./model/page-seo";
export type {
  PageSeoRecord,
  PageSeoTranslation,
  SeoEntityKind,
  SeoImagePreview,
  SeoManualOverrides,
  SeoManualRootField,
  SeoManualTranslationField,
  SeoOpenGraphData,
  SeoOpenGraphType,
  SeoRobotsDirectives,
  SeoSocialTranslation,
  SeoStructuredData,
  SeoStructuredDataType,
  SeoTargetType,
  SeoTranslationManualOverrides,
  SeoTwitterCardType,
  SeoTwitterData,
} from "./model/page-seo";
export { AutomaticSeoError, createAutomaticSeoSynchronizer } from "./service/automatic-seo";
export type { AutomaticSeoSynchronizer } from "./service/automatic-seo";
export { findSeoMetadataByPath } from "./repository/metadata-read";
export type { SeoMetadataRecord } from "./repository/metadata-read";
export { createFallbackNextMetadata, createNextMetadata } from "./service/next-metadata";
export type {
  SeoMetadataFallback,
  SeoMetadataImage,
  SeoSiteMetadataSettings,
} from "./service/next-metadata";
export {
  createStructuredDataGraph,
  serializeStructuredData,
  structuredDataGraphSchema,
} from "./service/structured-data";
export type {
  StructuredDataAddress,
  StructuredDataGraph,
  StructuredDataSite,
} from "./service/structured-data";
export {
  SEO_EXCLUDED_PATH_PREFIXES,
  STATIC_SEO_PAGES,
  STATIC_SEO_PAGE_KEYS,
  isSeoExcludedPath,
  isStaticSeoPageKey,
} from "./policy/static-pages";
export type { StaticSeoPageKey } from "./policy/static-pages";
export {
  StaticSeoRepositoryConflictError,
  createStaticSeoRepository,
} from "./repository/static-seo";
export type {
  StaticSeoRepository,
  StaticSeoSnapshot,
  StaticSeoWrite,
} from "./repository/static-seo";
export { StaticSeoServiceError, createStaticSeoServices } from "./service/static-seo";
export type {
  StaticSeoAction,
  StaticSeoActor,
  StaticSeoAuditEvent,
  StaticSeoServiceDependencies,
} from "./service/static-seo";
export { createStaticSeoAuditSink } from "./service/seo-audit";
export {
  staticSeoCreateSchema,
  staticSeoKeyParametersSchema,
  staticSeoTranslationSchema,
  staticSeoUpdateSchema,
} from "./validation/static-seo-request";
export type { StaticSeoCreateInput, StaticSeoUpdateInput } from "./validation/static-seo-request";
