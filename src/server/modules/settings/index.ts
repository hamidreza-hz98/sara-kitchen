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
export {
  SOCIAL_ICON_KEYS,
  SOCIAL_MAX_LINKS,
  SOCIAL_PLATFORMS,
  parseSocialSettings,
  socialSettingsDataSchema,
  socialSettingsPayloadSchema,
  socialSettingsTranslationValueSchema,
} from "./validation/social-settings";
export type {
  SocialIconKey,
  SocialPlatform,
  SocialSettingsData,
  SocialSettingsPayload,
  SocialSettingsTranslation,
  SocialSettingsTranslationValue,
} from "./validation/social-settings";
export { projectPublicSocialSettings } from "./service/social-public";
export type { PublicSocialLink, PublicSocialSettings } from "./service/social-public";
export {
  LANGUAGE_VISIBILITIES,
  languageSettingsDataSchema,
  languageSettingsPayloadSchema,
  languageSettingsTranslationValueSchema,
  parseLanguageSettings,
} from "./validation/language-settings";
export type {
  LanguageSettingsData,
  LanguageSettingsPayload,
  LanguageSettingsTranslation,
  LanguageSettingsTranslationValue,
  LanguageVisibility,
} from "./validation/language-settings";
export {
  configuredFallbackOrder,
  projectPublicLanguageSettings,
  resolveConfiguredLocale,
} from "./service/language-settings";
export type { PublicLanguageOption, PublicLanguageSettings } from "./service/language-settings";
export {
  ABOUT_MAX_CALLS_TO_ACTION,
  ABOUT_MAX_KITCHEN_MEDIA,
  ABOUT_MAX_STORY_SECTIONS,
  ABOUT_MAX_TEAM_MEMBERS,
  ABOUT_MAX_VALUES,
  aboutSettingsDataSchema,
  aboutSettingsPayloadSchema,
  aboutSettingsTranslationValueSchema,
  parseAboutSettings,
} from "./validation/about-settings";
export type {
  AboutSettingsData,
  AboutSettingsPayload,
  AboutSettingsTranslation,
  AboutSettingsTranslationValue,
} from "./validation/about-settings";
export {
  ABOUT_REFERENCE_ERROR_CODES,
  AboutSettingsReferenceError,
  collectAboutMediaUses,
  createAboutReferenceDependencies,
  validateAboutSettingsMediaReferences,
} from "./service/about-references";
export type {
  AboutMediaKind,
  AboutReferenceDependencies,
  AboutReferenceErrorCode,
  AboutReferenceIssue,
} from "./service/about-references";
export {
  FAQ_MAX_ENTRIES,
  faqSettingsDataSchema,
  faqSettingsPayloadSchema,
  faqSettingsTranslationValueSchema,
  parseFaqSettings,
} from "./validation/faq-settings";
export type {
  FaqSettingsData,
  FaqSettingsPayload,
  FaqSettingsTranslation,
  FaqSettingsTranslationValue,
} from "./validation/faq-settings";
export {
  FaqSettingsOperationError,
  applyFaqSettingsOperation,
  projectPublicFaqSettings,
  toFaqStructuredDataInputs,
} from "./service/faq-settings";
export type {
  FaqSettingsOperation,
  PublicFaqEntry,
  PublicFaqSettings,
} from "./service/faq-settings";
export {
  POLICY_DOCUMENT_TYPES,
  POLICY_MAX_SECTIONS,
  POLICY_PUBLICATION_STATES,
  parsePolicyVersionContent,
  policyVersionContentSchema,
  policyVersionTranslationSchema,
} from "./validation/policy-version";
export type {
  PolicyDocumentType,
  PolicyLocalizedTranslation,
  PolicyPublicationState,
  PolicySectionTranslation,
  PolicyVersionContent,
  PolicyVersionTranslation,
} from "./validation/policy-version";
export {
  POLICY_VERSIONS_COLLECTION,
  POLICY_VERSION_QUERY_MUTATION_ERROR,
  getPolicyVersionModel,
  policyVersionSchema,
} from "./model/policy-version";
export type { PolicyVersionRecord } from "./model/policy-version";
export {
  POLICY_CONSENT_APPEND_ONLY_ERROR,
  POLICY_CONSENT_SOURCES,
  POLICY_CONSENT_SUBJECT_KINDS,
  getPolicyConsentModel,
  policyConsentSchema,
} from "./model/policy-consent";
export type {
  PolicyConsentRecord,
  PolicyConsentSnapshot,
  PolicyConsentSource,
  PolicyConsentSubjectKind,
} from "./model/policy-consent";
export {
  PolicyLifecycleError,
  calculatePolicyContentDigest,
  createPolicyVersionDraft,
  getPolicyConsentTrace,
  recordPolicyConsent,
  releasePolicyVersion,
} from "./service/policy-lifecycle";
export type {
  PolicyConsentTraceEntry,
  PolicyLifecycleErrorCode,
  RecordPolicyConsentInput,
} from "./service/policy-lifecycle";
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
