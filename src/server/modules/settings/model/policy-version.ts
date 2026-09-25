import "server-only";

import { isValidObjectId, Schema } from "mongoose";
import type { Connection, HydratedDocument, Model, Types } from "mongoose";

import { createBaseSchema, type BaseDocumentFields } from "@/server/database/schema";

import {
  POLICY_DOCUMENT_TYPES,
  POLICY_PUBLICATION_STATES,
  policyVersionContentSchema,
  type PolicyDocumentType,
  type PolicyPublicationState,
  type PolicyVersionTranslation,
} from "../validation/policy-version";

export const POLICY_VERSIONS_COLLECTION = "policy_versions" as const;
export const POLICY_VERSION_QUERY_MUTATION_ERROR =
  "policy_version_query_mutation_forbidden" as const;

export type PolicyVersionRecord = BaseDocumentFields & {
  contentDigest: string | null;
  documentType: PolicyDocumentType;
  effectiveAt: Date;
  publishedAt: Date | null;
  retiredAt: Date | null;
  sectionIds: string[];
  state: PolicyPublicationState;
  translations: PolicyVersionTranslation[];
  version: number;
  createdByAdminId: Types.ObjectId;
};

function validContent(document: PolicyVersionRecord): boolean {
  return policyVersionContentSchema.safeParse({
    documentType: document.documentType,
    version: document.version,
    effectiveAt: document.effectiveAt,
    sectionIds: document.sectionIds,
    translations: document.translations,
  }).success;
}

export const policyVersionSchema = createBaseSchema<PolicyVersionRecord>(
  {
    documentType: { type: String, enum: POLICY_DOCUMENT_TYPES, immutable: true, required: true },
    version: { type: Number, immutable: true, required: true },
    state: { type: String, enum: POLICY_PUBLICATION_STATES, required: true, default: "draft" },
    effectiveAt: { type: Date, required: true },
    publishedAt: { type: Date, default: null },
    retiredAt: { type: Date, default: null },
    sectionIds: { type: [String], required: true },
    translations: { type: Schema.Types.Mixed, required: true },
    contentDigest: {
      type: String,
      default: null,
      validate: {
        validator: (value: string | null) => value === null || /^[a-f\d]{64}$/u.test(value),
        message: "Policy content digest must be SHA-256 hex.",
      },
    },
    createdByAdminId: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      immutable: true,
      required: true,
      validate: { validator: isValidObjectId, message: "Policy author must be an administrator." },
    },
  },
  { collection: POLICY_VERSIONS_COLLECTION, schemaVersion: 1 },
);

policyVersionSchema.pre("validate", function enforcePolicyVersionState() {
  if (!validContent(this)) {
    this.invalidate(
      "translations",
      "Policy content does not satisfy the versioned content contract.",
    );
  }
  const released = this.state !== "draft";
  if (released !== Boolean(this.publishedAt) || released !== Boolean(this.contentDigest)) {
    this.invalidate("state", "Released policies require publication time and a content digest.");
  }
  if ((this.state === "retired") !== Boolean(this.retiredAt)) {
    this.invalidate("retiredAt", "Only retired policies have a retirement timestamp.");
  }
  if (this.publishedAt && this.retiredAt && this.retiredAt < this.publishedAt) {
    this.invalidate("retiredAt", "Policy retirement cannot precede publication.");
  }

  const initialState = this.$locals.initialState as PolicyPublicationState | undefined;
  if (initialState && initialState !== "draft") {
    const immutablePaths = [
      "documentType",
      "version",
      "effectiveAt",
      "sectionIds",
      "translations",
      "contentDigest",
      "publishedAt",
      "createdByAdminId",
    ];
    if (immutablePaths.some((path) => this.isModified(path))) {
      this.invalidate("state", "Released policy content and evidence fields are immutable.");
    }
    const allowedTransition =
      (initialState === "scheduled" &&
        ["scheduled", "published", "retired"].includes(this.state)) ||
      (initialState === "published" && ["published", "retired"].includes(this.state)) ||
      (initialState === "retired" && this.state === "retired");
    if (!allowedTransition)
      this.invalidate("state", "Policy publication state cannot move backwards.");
  }
});

policyVersionSchema.post(
  "init",
  function rememberInitialState(document: HydratedDocument<PolicyVersionRecord>) {
    document.$locals.initialState = document.state;
  },
);

policyVersionSchema.index(
  { documentType: 1, version: 1 },
  { unique: true, name: "policy_document_version_unique" },
);
policyVersionSchema.index(
  { documentType: 1, state: 1, effectiveAt: -1 },
  { name: "policy_current" },
);
policyVersionSchema.index({ state: 1, effectiveAt: 1 }, { name: "policy_scheduled_effective" });

const queryMutations = [
  "updateOne",
  "updateMany",
  "replaceOne",
  "findOneAndUpdate",
  "findOneAndReplace",
  "deleteOne",
  "deleteMany",
  "findOneAndDelete",
] as const;
for (const operation of queryMutations) {
  policyVersionSchema.pre(operation, function rejectPolicyQueryMutation() {
    throw new Error(POLICY_VERSION_QUERY_MUTATION_ERROR);
  });
}
policyVersionSchema.pre(
  "deleteOne",
  { document: true, query: false },
  function rejectPolicyDelete() {
    throw new Error(POLICY_VERSION_QUERY_MUTATION_ERROR);
  },
);
policyVersionSchema.pre("bulkWrite", function rejectPolicyBulkMutation() {
  throw new Error(POLICY_VERSION_QUERY_MUTATION_ERROR);
});

export function getPolicyVersionModel(connection: Connection): Model<PolicyVersionRecord> {
  return (
    (connection.models.PolicyVersion as Model<PolicyVersionRecord> | undefined) ??
    connection.model<PolicyVersionRecord>("PolicyVersion", policyVersionSchema)
  );
}
