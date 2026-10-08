/** Public entry point for contact-submission use cases. */
export const MODULE_NAME = "contacts" as const;
export {
  CONTACT_INTERNAL_NOTE_MAX_LENGTH,
  CONTACT_MAX_INTERNAL_NOTES,
  CONTACT_MESSAGE_MAX_LENGTH,
  CONTACT_MESSAGE_MIN_LENGTH,
  CONTACT_RETENTION_DAYS,
  CONTACT_SOURCE_CHANNELS,
  CONTACT_SPAM_DISPOSITIONS,
  CONTACT_SPAM_PROVIDERS,
  CONTACT_SPAM_SIGNALS,
  CONTACT_SUBMISSION_STATUSES,
  contactRetentionExpiresAt,
  type ContactConsent,
  type ContactInternalNote,
  type ContactSourceChannel,
  type ContactSourceMetadata,
  type ContactSpamDisposition,
  type ContactSpamMetadata,
  type ContactSpamProvider,
  type ContactSpamSignal,
  type ContactSubmissionRecord,
  type ContactSubmissionStatus,
} from "./model/contact-submission";
export {
  contactSubmissionInputSchema,
  type ContactSubmissionInput,
} from "./validation/contact-submission";
export {
  isValidContactEmail,
  isValidContactMobile,
  isValidContactName,
  normalizeContactEmail,
  normalizeContactMobile,
  normalizeContactName,
} from "./validation/contact-identity";
