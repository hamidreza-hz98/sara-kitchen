import "server-only";

import { isValidObjectId, Schema } from "mongoose";
import type { Connection, Model, Types } from "mongoose";

import { SUPPORTED_LOCALES, type SupportedLocale } from "@/constants";
import { createBaseSchema, type BaseDocumentFields } from "@/server/database/schema";
import {
  isValidContactEmail,
  isValidContactMobile,
  isValidContactName,
  normalizeContactEmail,
  normalizeContactMobile,
  normalizeContactName,
} from "../validation/contact-identity";

export const CONTACT_SUBMISSION_STATUSES = [
  "new",
  "in_progress",
  "resolved",
  "spam",
  "archived",
] as const;
export const CONTACT_SOURCE_CHANNELS = ["website", "email", "phone", "whatsapp", "admin"] as const;
export const CONTACT_SPAM_DISPOSITIONS = ["pending", "clean", "suspected", "blocked"] as const;
export const CONTACT_SPAM_SIGNALS = [
  "honeypot",
  "rate_limit",
  "duplicate",
  "link_density",
  "provider_flag",
] as const;
export const CONTACT_SPAM_PROVIDERS = ["local", "cloudflare_turnstile"] as const;
export const CONTACT_MESSAGE_MIN_LENGTH = 10;
export const CONTACT_MESSAGE_MAX_LENGTH = 4_000;
export const CONTACT_INTERNAL_NOTE_MAX_LENGTH = 2_000;
export const CONTACT_MAX_INTERNAL_NOTES = 100;
export const CONTACT_RETENTION_DAYS = {
  new: 730,
  in_progress: 730,
  resolved: 730,
  spam: 90,
  archived: 365,
} as const satisfies Record<ContactSubmissionStatus, number>;

export type ContactSubmissionStatus = (typeof CONTACT_SUBMISSION_STATUSES)[number];
export type ContactSourceChannel = (typeof CONTACT_SOURCE_CHANNELS)[number];
export type ContactSpamDisposition = (typeof CONTACT_SPAM_DISPOSITIONS)[number];
export type ContactSpamSignal = (typeof CONTACT_SPAM_SIGNALS)[number];
export type ContactSpamProvider = (typeof CONTACT_SPAM_PROVIDERS)[number];

export type ContactInternalNote = {
  _id: Types.ObjectId;
  authorAdminId: Types.ObjectId;
  body: string;
  createdAt: Date;
};

export type ContactSourceMetadata = {
  channel: ContactSourceChannel;
  pagePath: string | null;
  referrerHost: string | null;
  campaign: string | null;
  requestId: string | null;
  fingerprintHash: string | null;
};

export type ContactConsent = {
  privacyAccepted: boolean;
  privacyPolicyVersion: string;
  acceptedAt: Date;
  marketingAccepted: boolean;
};

export type ContactSpamMetadata = {
  disposition: ContactSpamDisposition;
  score: number;
  signals: ContactSpamSignal[];
  provider: ContactSpamProvider | null;
  checkedAt: Date | null;
  honeypotMatched: boolean;
};

export type ContactSubmissionRecord = BaseDocumentFields & {
  fullName: string;
  mobile: string | null;
  email: string | null;
  message: string;
  locale: SupportedLocale;
  status: ContactSubmissionStatus;
  assigneeAdminId: Types.ObjectId | null;
  internalNotes: ContactInternalNote[];
  source: ContactSourceMetadata;
  consent: ContactConsent;
  spam: ContactSpamMetadata;
  retentionExpiresAt: Date;
};

export function contactRetentionExpiresAt(
  status: ContactSubmissionStatus,
  referenceDate = new Date(),
): Date {
  const result = new Date(referenceDate);
  result.setUTCDate(result.getUTCDate() + CONTACT_RETENTION_DAYS[status]);
  return result;
}

const nullableText = (maximum: number) => ({
  type: String,
  trim: true,
  maxlength: maximum,
  default: null,
  set: (value: unknown) => {
    if (typeof value !== "string") return null;
    const normalized = value.normalize("NFKC").trim();
    return normalized || null;
  },
});

const internalNoteSchema = new Schema<ContactInternalNote>(
  {
    authorAdminId: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
      validate: { validator: isValidObjectId, message: "Internal-note author must be an Admin." },
    },
    body: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: CONTACT_INTERNAL_NOTE_MAX_LENGTH,
    },
    createdAt: { type: Date, required: true, default: Date.now, immutable: true },
  },
  { id: false },
);

const sourceSchema = new Schema<ContactSourceMetadata>(
  {
    channel: { type: String, enum: CONTACT_SOURCE_CHANNELS, required: true, default: "website" },
    pagePath: nullableText(500),
    referrerHost: nullableText(253),
    campaign: nullableText(120),
    requestId: nullableText(128),
    fingerprintHash: nullableText(128),
  },
  { _id: false, id: false },
);

const consentSchema = new Schema<ContactConsent>(
  {
    privacyAccepted: { type: Boolean, required: true },
    privacyPolicyVersion: { type: String, required: true, trim: true, minlength: 1, maxlength: 64 },
    acceptedAt: { type: Date, required: true, immutable: true },
    marketingAccepted: { type: Boolean, required: true, default: false },
  },
  { _id: false, id: false },
);

const spamSchema = new Schema<ContactSpamMetadata>(
  {
    disposition: {
      type: String,
      enum: CONTACT_SPAM_DISPOSITIONS,
      required: true,
      default: "pending",
    },
    score: {
      type: Number,
      required: true,
      default: 0,
      validate: {
        validator: (value: number) => Number.isSafeInteger(value) && value >= 0 && value <= 100,
        message: "Spam score must be an integer from 0 through 100.",
      },
    },
    signals: {
      type: [{ type: String, enum: CONTACT_SPAM_SIGNALS }],
      default: [],
      validate: {
        validator: (values: ContactSpamSignal[]) =>
          values.length <= CONTACT_SPAM_SIGNALS.length && new Set(values).size === values.length,
        message: "Spam signals must be unique allow-listed values.",
      },
    },
    provider: { type: String, enum: CONTACT_SPAM_PROVIDERS, default: null },
    checkedAt: { type: Date, default: null },
    honeypotMatched: { type: Boolean, required: true, default: false },
  },
  { _id: false, id: false },
);

export const contactSubmissionSchema = createBaseSchema<ContactSubmissionRecord>(
  {
    fullName: {
      type: String,
      required: true,
      set: normalizeContactName,
      validate: { validator: isValidContactName, message: "Enter a valid full name." },
    },
    mobile: {
      type: String,
      default: null,
      set: (value: unknown) =>
        typeof value === "string" && value.trim() ? normalizeContactMobile(value) : null,
      validate: {
        validator: (value: string | null) => value === null || isValidContactMobile(value),
        message: "Contact mobile must be a normalized international number.",
      },
    },
    email: {
      type: String,
      default: null,
      set: (value: unknown) => normalizeContactEmail(typeof value === "string" ? value : null),
      validate: {
        validator: isValidContactEmail,
        message: "Contact email must be valid.",
      },
    },
    message: {
      type: String,
      required: true,
      trim: true,
      minlength: CONTACT_MESSAGE_MIN_LENGTH,
      maxlength: CONTACT_MESSAGE_MAX_LENGTH,
    },
    locale: { type: String, enum: SUPPORTED_LOCALES, required: true },
    status: { type: String, enum: CONTACT_SUBMISSION_STATUSES, required: true, default: "new" },
    assigneeAdminId: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
      validate: {
        validator: (value: Types.ObjectId | null) => value === null || isValidObjectId(value),
        message: "Contact assignee must be an Admin.",
      },
    },
    internalNotes: {
      type: [internalNoteSchema],
      default: [],
      validate: {
        validator: (notes: ContactInternalNote[]) => notes.length <= CONTACT_MAX_INTERNAL_NOTES,
        message: `A contact submission supports at most ${CONTACT_MAX_INTERNAL_NOTES} notes.`,
      },
    },
    source: { type: sourceSchema, required: true, default: () => ({}) },
    consent: { type: consentSchema, required: true },
    spam: { type: spamSchema, required: true, default: () => ({}) },
    retentionExpiresAt: {
      type: Date,
      required: true,
      default(this: ContactSubmissionRecord) {
        return contactRetentionExpiresAt(this.status ?? "new");
      },
    },
  },
  {
    collection: "contact_submissions",
    schemaVersion: 1,
    searchSourcePaths: ["fullName", "mobile", "email", "message"],
  },
);

contactSubmissionSchema.pre("validate", function validateContactSubmission() {
  if (!this.mobile && !this.email) {
    this.invalidate("mobile", "Provide at least one contact method.");
  }
  if (!this.consent?.privacyAccepted) {
    this.invalidate("consent.privacyAccepted", "Privacy consent is required.");
  }
  const checked = this.spam?.checkedAt instanceof Date;
  const provider = this.spam?.provider !== null && this.spam?.provider !== undefined;
  if (this.spam?.disposition === "pending" && (checked || provider)) {
    this.invalidate("spam", "Pending spam checks cannot contain provider results.");
  }
  if (this.spam?.disposition !== "pending" && (!checked || !provider)) {
    this.invalidate("spam", "Completed spam checks require provider and checkedAt.");
  }
  if (this.spam?.honeypotMatched && !this.spam.signals.includes("honeypot")) {
    this.invalidate("spam.signals", "A honeypot match must include the honeypot signal.");
  }
});

contactSubmissionSchema.index(
  { status: 1, createdAt: -1, _id: -1 },
  { name: "contact_status_created" },
);
contactSubmissionSchema.index(
  { assigneeAdminId: 1, status: 1, updatedAt: -1 },
  { name: "contact_assignee_workflow" },
);
contactSubmissionSchema.index(
  { "spam.disposition": 1, "spam.score": -1, createdAt: -1 },
  { name: "contact_spam_review" },
);
contactSubmissionSchema.index(
  { retentionExpiresAt: 1 },
  { name: "contact_retention_ttl", expireAfterSeconds: 0 },
);

export function getContactSubmissionModel(connection: Connection): Model<ContactSubmissionRecord> {
  return (
    (connection.models.ContactSubmission as Model<ContactSubmissionRecord> | undefined) ??
    connection.model<ContactSubmissionRecord>("ContactSubmission", contactSubmissionSchema)
  );
}
