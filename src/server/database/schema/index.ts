export {
  ACTIVE_DOCUMENT_FILTER,
  ACTOR_KINDS,
  createActorMetadata,
  createBaseSchema,
  NORMALIZED_SEARCH_FIELD,
  type ActorKind,
  type ActorMetadata,
  type BaseDocumentFields,
  type BaseSchemaOptions,
  type NormalizedSearchFields,
  type SoftDeleteFields,
} from "./base-schema";
export { buildNormalizedSearchText, normalizeSearchText } from "./search-normalization";
export {
  CANONICAL_CONTENT_LOCALE,
  TRANSLATION_VALIDATION_CODES,
  createTranslationsField,
  validateTranslationValues,
  type TranslationTextField,
  type TranslationValidationCode,
  type TranslationValidationIssue,
  type TranslationValue,
  type TranslationValueOptions,
  type WithTranslations,
} from "./translation-values";
