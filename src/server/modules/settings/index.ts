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
export type {
  SettingsMigrationErrorCode,
  SettingsMigrationResult,
  SettingsMigrationRunResult,
} from "./migration/settings-migrations";
