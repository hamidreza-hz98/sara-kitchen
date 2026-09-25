import "server-only";

import { createHash } from "node:crypto";

import { isValidObjectId, Types } from "mongoose";
import type { Connection } from "mongoose";

import type { SupportedLocale } from "@/constants";

import {
  getPolicyConsentModel,
  type PolicyConsentRecord,
  type PolicyConsentSource,
  type PolicyConsentSubjectKind,
} from "../model/policy-consent";
import { getPolicyVersionModel, type PolicyVersionRecord } from "../model/policy-version";
import {
  parsePolicyVersionContent,
  type PolicyPublicationState,
  type PolicyVersionContent,
} from "../validation/policy-version";

export type PolicyLifecycleErrorCode =
  | "consent_before_effective"
  | "invalid_identifier"
  | "invalid_state"
  | "policy_not_found"
  | "policy_not_released";

export class PolicyLifecycleError extends Error {
  readonly code: PolicyLifecycleErrorCode;

  constructor(code: PolicyLifecycleErrorCode) {
    super(`policy_${code}`);
    this.name = "PolicyLifecycleError";
    this.code = code;
  }
}

function digestInput(content: PolicyVersionContent): string {
  return JSON.stringify({
    documentType: content.documentType,
    version: content.version,
    effectiveAt: content.effectiveAt.toISOString(),
    sectionIds: content.sectionIds,
    translations: content.translations,
  });
}

export function calculatePolicyContentDigest(content: PolicyVersionContent): string {
  return createHash("sha256").update(digestInput(content), "utf8").digest("hex");
}

function contentFromRecord(policy: PolicyVersionRecord): PolicyVersionContent {
  return parsePolicyVersionContent({
    documentType: policy.documentType,
    version: policy.version,
    effectiveAt: policy.effectiveAt,
    sectionIds: policy.sectionIds,
    translations: policy.translations,
  });
}

export async function createPolicyVersionDraft(
  connection: Connection,
  contentInput: unknown,
  createdByAdminId: string,
): Promise<PolicyVersionRecord> {
  if (!isValidObjectId(createdByAdminId)) throw new PolicyLifecycleError("invalid_identifier");
  const content = parsePolicyVersionContent(contentInput);
  return getPolicyVersionModel(connection).create({
    ...content,
    state: "draft",
    publishedAt: null,
    retiredAt: null,
    contentDigest: null,
    createdByAdminId: new Types.ObjectId(createdByAdminId),
  });
}

/**
 * Releases a policy atomically. Future-effective versions become scheduled; effective versions
 * retire every previously published version of the same document type before activation.
 */
export async function releasePolicyVersion(
  connection: Connection,
  policyVersionId: string,
  now = new Date(),
): Promise<PolicyVersionRecord> {
  if (!isValidObjectId(policyVersionId)) throw new PolicyLifecycleError("invalid_identifier");
  let released: PolicyVersionRecord | null = null;
  await connection.transaction(async (session) => {
    const PolicyVersion = getPolicyVersionModel(connection);
    const policy = await PolicyVersion.findById(policyVersionId).session(session).exec();
    if (!policy) throw new PolicyLifecycleError("policy_not_found");
    if (!(["draft", "scheduled"] as PolicyPublicationState[]).includes(policy.state)) {
      throw new PolicyLifecycleError("invalid_state");
    }
    if (policy.state === "draft") {
      const content = contentFromRecord(policy);
      policy.contentDigest = calculatePolicyContentDigest(content);
      policy.publishedAt = now;
    }
    if (policy.effectiveAt > now) {
      policy.state = "scheduled";
      await policy.save({ session });
      released = policy.toObject();
      return;
    }

    const current = await PolicyVersion.find({
      _id: { $ne: policy._id },
      documentType: policy.documentType,
      state: "published",
    })
      .session(session)
      .exec();
    for (const previous of current) {
      previous.state = "retired";
      previous.retiredAt = now;
      await previous.save({ session });
    }
    policy.state = "published";
    await policy.save({ session });
    released = policy.toObject();
  });
  if (!released) throw new PolicyLifecycleError("policy_not_found");
  return released;
}

export type RecordPolicyConsentInput = Readonly<{
  acceptedAt?: Date;
  acceptedLocale: SupportedLocale;
  customerId?: string | null;
  policyVersionId: string;
  requestId?: string | null;
  source: PolicyConsentSource;
  subjectId: string;
  subjectKind: PolicyConsentSubjectKind;
}>;

export async function recordPolicyConsent(
  connection: Connection,
  input: RecordPolicyConsentInput,
): Promise<PolicyConsentRecord> {
  if (
    !isValidObjectId(input.policyVersionId) ||
    !isValidObjectId(input.subjectId) ||
    (input.customerId !== undefined &&
      input.customerId !== null &&
      !isValidObjectId(input.customerId))
  ) {
    throw new PolicyLifecycleError("invalid_identifier");
  }
  const acceptedAt = input.acceptedAt ?? new Date();
  const PolicyVersion = getPolicyVersionModel(connection);
  const policy = await PolicyVersion.findById(input.policyVersionId).lean().exec();
  if (!policy) throw new PolicyLifecycleError("policy_not_found");
  const eligibleHistoricalImport =
    input.source === "admin-import" &&
    policy.state === "retired" &&
    Boolean(policy.retiredAt && acceptedAt <= policy.retiredAt);
  if (policy.state !== "published" && !eligibleHistoricalImport) {
    throw new PolicyLifecycleError("policy_not_released");
  }
  if (policy.effectiveAt > acceptedAt) throw new PolicyLifecycleError("consent_before_effective");
  if (!policy.contentDigest) throw new PolicyLifecycleError("policy_not_released");

  const Consent = getPolicyConsentModel(connection);
  try {
    return await Consent.create({
      subjectKind: input.subjectKind,
      subjectId: new Types.ObjectId(input.subjectId),
      customerId: input.customerId ? new Types.ObjectId(input.customerId) : null,
      policyVersionId: policy._id,
      policySnapshot: {
        documentType: policy.documentType,
        version: policy.version,
        effectiveAt: policy.effectiveAt,
        contentDigest: policy.contentDigest,
      },
      acceptedLocale: input.acceptedLocale,
      acceptedAt,
      source: input.source,
      requestId: input.requestId ?? null,
    });
  } catch (error) {
    if (
      typeof error !== "object" ||
      error === null ||
      !("code" in error) ||
      error.code !== 11_000
    ) {
      throw error;
    }
    const existing = await Consent.findOne({
      subjectKind: input.subjectKind,
      subjectId: new Types.ObjectId(input.subjectId),
      policyVersionId: policy._id,
    }).exec();
    if (!existing) throw error;
    return existing;
  }
}

export type PolicyConsentTraceEntry = Readonly<{
  acceptedAt: Date;
  acceptedLocale: SupportedLocale;
  consentId: string;
  integrity: "matched" | "missing-policy" | "snapshot-mismatch";
  policy: Readonly<{
    contentDigest: string;
    documentType: string;
    effectiveAt: Date;
    id: string;
    version: number;
  }> | null;
  snapshot: Readonly<{
    contentDigest: string;
    documentType: string;
    effectiveAt: Date;
    version: number;
  }>;
  source: PolicyConsentSource;
}>;

/** Returns durable evidence for an account or order, including snapshot-to-policy integrity. */
export async function getPolicyConsentTrace(
  connection: Connection,
  subjectKind: PolicyConsentSubjectKind,
  subjectId: string,
): Promise<readonly PolicyConsentTraceEntry[]> {
  if (!isValidObjectId(subjectId)) throw new PolicyLifecycleError("invalid_identifier");
  const consents = await getPolicyConsentModel(connection)
    .find({ subjectKind, subjectId: new Types.ObjectId(subjectId) })
    .sort({ acceptedAt: 1, _id: 1 })
    .lean()
    .exec();
  const policyIds = [
    ...new Set(consents.map(({ policyVersionId }) => policyVersionId.toHexString())),
  ];
  const policies = await getPolicyVersionModel(connection)
    .find({ _id: { $in: policyIds.map((id) => new Types.ObjectId(id)) } })
    .lean()
    .exec();
  const byId = new Map(policies.map((policy) => [policy._id.toHexString(), policy]));

  return consents.map((consent) => {
    const policy = byId.get(consent.policyVersionId.toHexString());
    const matched =
      policy &&
      policy.documentType === consent.policySnapshot.documentType &&
      policy.version === consent.policySnapshot.version &&
      policy.contentDigest === consent.policySnapshot.contentDigest &&
      policy.effectiveAt.getTime() === consent.policySnapshot.effectiveAt.getTime();
    return {
      consentId: consent._id.toHexString(),
      acceptedAt: consent.acceptedAt,
      acceptedLocale: consent.acceptedLocale,
      source: consent.source,
      snapshot: consent.policySnapshot,
      integrity: policy ? (matched ? "matched" : "snapshot-mismatch") : "missing-policy",
      policy: policy
        ? {
            id: policy._id.toHexString(),
            documentType: policy.documentType,
            version: policy.version,
            effectiveAt: policy.effectiveAt,
            contentDigest: policy.contentDigest ?? "",
          }
        : null,
    };
  });
}
