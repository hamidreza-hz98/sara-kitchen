import "server-only";

import { isValidObjectId, Schema } from "mongoose";
import type { Connection, Model, Types } from "mongoose";

import { SUPPORTED_LOCALES, type SupportedLocale } from "@/constants";
import { createBaseSchema, type BaseDocumentFields } from "@/server/database/schema";

import { POLICY_DOCUMENT_TYPES, type PolicyDocumentType } from "../validation/policy-version";

export const POLICY_CONSENT_SUBJECT_KINDS = ["account", "order"] as const;
export const POLICY_CONSENT_SOURCES = [
  "signup",
  "checkout",
  "account-update",
  "admin-import",
] as const;
export const POLICY_CONSENT_APPEND_ONLY_ERROR = "policy_consent_is_append_only" as const;

export type PolicyConsentSubjectKind = (typeof POLICY_CONSENT_SUBJECT_KINDS)[number];
export type PolicyConsentSource = (typeof POLICY_CONSENT_SOURCES)[number];

export type PolicyConsentSnapshot = {
  contentDigest: string;
  documentType: PolicyDocumentType;
  effectiveAt: Date;
  version: number;
};

export type PolicyConsentRecord = BaseDocumentFields & {
  acceptedAt: Date;
  acceptedLocale: SupportedLocale;
  customerId: Types.ObjectId | null;
  policySnapshot: PolicyConsentSnapshot;
  policyVersionId: Types.ObjectId;
  requestId: string | null;
  source: PolicyConsentSource;
  subjectId: Types.ObjectId;
  subjectKind: PolicyConsentSubjectKind;
};

const snapshotSchema = new Schema<PolicyConsentSnapshot>(
  {
    documentType: { type: String, enum: POLICY_DOCUMENT_TYPES, immutable: true, required: true },
    version: { type: Number, immutable: true, required: true, min: 1 },
    effectiveAt: { type: Date, immutable: true, required: true },
    contentDigest: {
      type: String,
      immutable: true,
      required: true,
      validate: { validator: (value: string) => /^[a-f\d]{64}$/u.test(value) },
    },
  },
  { _id: false, id: false },
);

export const policyConsentSchema = createBaseSchema<PolicyConsentRecord>(
  {
    subjectKind: {
      type: String,
      enum: POLICY_CONSENT_SUBJECT_KINDS,
      immutable: true,
      required: true,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      immutable: true,
      required: true,
      validate: { validator: isValidObjectId },
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      immutable: true,
      default: null,
      validate: {
        validator: (value: Types.ObjectId | null) => value === null || isValidObjectId(value),
      },
    },
    policyVersionId: {
      type: Schema.Types.ObjectId,
      ref: "PolicyVersion",
      immutable: true,
      required: true,
      validate: { validator: isValidObjectId },
    },
    policySnapshot: { type: snapshotSchema, immutable: true, required: true },
    acceptedLocale: { type: String, enum: SUPPORTED_LOCALES, immutable: true, required: true },
    acceptedAt: { type: Date, immutable: true, required: true },
    source: { type: String, enum: POLICY_CONSENT_SOURCES, immutable: true, required: true },
    requestId: { type: String, immutable: true, default: null, maxlength: 128 },
  },
  { collection: "policy_consents", schemaVersion: 1 },
);

policyConsentSchema.pre("validate", function enforceConsentInvariants() {
  if (!this.isNew) throw new Error(POLICY_CONSENT_APPEND_ONLY_ERROR);
  this.createdBy = null;
  this.updatedBy = null;
  if (this.subjectKind === "account") {
    if (!this.customerId || !this.customerId.equals(this.subjectId)) {
      this.invalidate("customerId", "Account consent must identify the same customer subject.");
    }
  }
  if (this.acceptedAt && this.policySnapshot?.effectiveAt > this.acceptedAt) {
    this.invalidate("acceptedAt", "A policy cannot be accepted before its effective date.");
  }
});

policyConsentSchema.pre("save", function rejectExistingConsentSave() {
  if (!this.isNew) throw new Error(POLICY_CONSENT_APPEND_ONLY_ERROR);
});

policyConsentSchema.index(
  { subjectKind: 1, subjectId: 1, policyVersionId: 1 },
  { unique: true, name: "policy_consent_subject_version_unique" },
);
policyConsentSchema.index(
  { customerId: 1, acceptedAt: -1, _id: -1 },
  { name: "policy_consent_customer_timeline" },
);
policyConsentSchema.index(
  { "policySnapshot.documentType": 1, "policySnapshot.version": 1, acceptedAt: -1 },
  { name: "policy_consent_document_version" },
);

const blockedOperations = [
  "updateOne",
  "updateMany",
  "replaceOne",
  "findOneAndUpdate",
  "findOneAndReplace",
  "deleteOne",
  "deleteMany",
  "findOneAndDelete",
] as const;
for (const operation of blockedOperations) {
  policyConsentSchema.pre(operation, function rejectConsentMutation() {
    throw new Error(POLICY_CONSENT_APPEND_ONLY_ERROR);
  });
}

policyConsentSchema.pre(
  "deleteOne",
  { document: true, query: false },
  function rejectConsentDelete() {
    throw new Error(POLICY_CONSENT_APPEND_ONLY_ERROR);
  },
);
policyConsentSchema.pre("bulkWrite", function rejectConsentBulkMutation() {
  throw new Error(POLICY_CONSENT_APPEND_ONLY_ERROR);
});

export function getPolicyConsentModel(connection: Connection): Model<PolicyConsentRecord> {
  return (
    (connection.models.PolicyConsent as Model<PolicyConsentRecord> | undefined) ??
    connection.model<PolicyConsentRecord>("PolicyConsent", policyConsentSchema)
  );
}
