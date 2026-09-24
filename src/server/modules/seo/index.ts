/** Public entry point for metadata and search-discovery use cases. */
export const MODULE_NAME = "seo" as const;

export {
  SEO_ENTITY_KINDS,
  SEO_IMAGE_PREVIEW_VALUES,
  SEO_MAX_KEYWORDS,
  SEO_MAX_STRUCTURED_DATA_BYTES,
  SEO_MAX_STRUCTURED_DATA_DEPTH,
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
  SeoOpenGraphData,
  SeoOpenGraphType,
  SeoRobotsDirectives,
  SeoSocialTranslation,
  SeoStructuredData,
  SeoStructuredDataType,
  SeoTargetType,
  SeoTwitterCardType,
  SeoTwitterData,
} from "./model/page-seo";
