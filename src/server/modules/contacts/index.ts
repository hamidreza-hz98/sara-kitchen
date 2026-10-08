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
  contactEmptyMutationSchema,
  contactIdParametersSchema,
  contactListQuerySchema,
  contactSubmissionInputSchema,
  contactWorkflowUpdateSchema,
  type ContactListQuery,
  type ContactSubmissionInput,
  type ContactWorkflowUpdateInput,
} from "./validation/contact-submission";
export {
  isValidContactEmail,
  isValidContactMobile,
  isValidContactName,
  normalizeContactEmail,
  normalizeContactMobile,
  normalizeContactName,
} from "./validation/contact-identity";
export {
  ContactRepositoryConflictError,
  createContactSubmissionRepository,
  type ContactListOptions,
  type ContactSubmissionCreate,
  type ContactSubmissionRepository,
  type ContactSubmissionSnapshot,
  type ContactWorkflowUpdate,
} from "./repository/contact-submission";
export {
  ContactFlowError,
  createContactFlow,
  type ContactActor,
  type ContactAdminView,
  type ContactAuditEvent,
  type ContactFlowAction,
  type ContactFlowDependencies,
  type ContactNotification,
} from "./service/contact-flow";
export { createContactAuditSink } from "./service/contact-audit";
