/** Public entry point for versioned application settings. */
export const MODULE_NAME = "settings" as const;

export {
  SETTINGS_COLLECTION,
  SETTINGS_PUBLICATION_POLICIES,
  SETTINGS_SCHEMA_VERSION,
  SETTINGS_SECTION_KEYS,
  SETTINGS_SECTION_REGISTRY,
  getSettingsSectionModel,
  isSafeSettingsJsonObject,
  isSettingsSectionKey,
  publicationPolicyForSettingsSection,
} from "./model/settings-section";
export type {
  SettingsJsonObject,
  SettingsPolicyFor,
  SettingsPublicationPolicy,
  SettingsRevision,
  SettingsSectionKey,
  SettingsSectionRecord,
  SettingsTranslation,
} from "./model/settings-section";
export {
  SettingsMigrationError,
  migrateSettingsSectionDocument,
  migrateSettingsSectionDocuments,
} from "./migration/settings-migrations";
export {
  HOMEPAGE_MAX_BANNERS,
  HOMEPAGE_MAX_BENEFITS,
  HOMEPAGE_MAX_BLOGS,
  HOMEPAGE_MAX_CATEGORY_BANNERS,
  HOMEPAGE_MAX_DISCOUNTED_DISHES,
  HOMEPAGE_MAX_FEATURED_DISHES,
  HOMEPAGE_MAX_HERO_SLIDES,
  HOMEPAGE_MAX_TESTIMONIALS,
  homepageSettingsDataSchema,
  homepageSettingsPayloadSchema,
  homepageSettingsTranslationValueSchema,
  parseHomepageSettings,
} from "./validation/homepage-settings";
export type {
  HomepageSettingsData,
  HomepageSettingsPayload,
  HomepageSettingsTranslation,
  HomepageSettingsTranslationValue,
} from "./validation/homepage-settings";
export {
  HOMEPAGE_REFERENCE_ERROR_CODES,
  HomepageSettingsReferenceError,
  createHomepageReferenceDependencies,
  validateHomepageSettingsReferences,
} from "./service/homepage-references";
export {
  CONTACT_MAP_PROVIDERS,
  CONTACT_MAX_PHONES,
  CONTACT_WEEKDAYS,
  contactSettingsDataSchema,
  contactSettingsPayloadSchema,
  contactSettingsTranslationValueSchema,
  parseContactSettings,
} from "./validation/contact-settings";
export type {
  ContactSettingsData,
  ContactSettingsPayload,
  ContactSettingsTranslation,
  ContactSettingsTranslationValue,
  ContactWeekday,
} from "./validation/contact-settings";
export { projectPublicContactSettings } from "./service/contact-public";
export type { PublicContactSettings } from "./service/contact-public";
export type {
  HomepageReferenceDependencies,
  HomepageReferenceErrorCode,
  HomepageReferenceIssue,
  HomepageReferenceKind,
  HomepageReferenceValidationMode,
} from "./service/homepage-references";
export type {
  SettingsMigrationErrorCode,
  SettingsMigrationResult,
  SettingsMigrationRunResult,
} from "./migration/settings-migrations";
