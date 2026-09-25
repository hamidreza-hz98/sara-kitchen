import type { NextRequest } from "next/server";

import { apiSuccess, handleApiRoute, parseJsonRequest } from "@/server/http";
import { recordAuditEvent } from "@/server/modules/logs";
import {
  createPolicyVersionDraft,
  getPolicyVersionModel,
  policyVersionContentSchema,
} from "@/server/modules/settings";

import { settingsRequestContext } from "../route-helper";

export const runtime = "nodejs";

function policySnapshot(policy: {
  _id: { toHexString(): string };
  documentType: string;
  version: number;
  state: string;
  effectiveAt: Date;
  publishedAt: Date | null;
  createdAt: Date;
  sectionIds: string[];
  translations: unknown;
}) {
  return {
    id: policy._id.toHexString(),
    documentType: policy.documentType,
    version: policy.version,
    state: policy.state,
    effectiveAt: policy.effectiveAt.toISOString(),
    publishedAt: policy.publishedAt?.toISOString() ?? null,
    createdAt: policy.createdAt.toISOString(),
    sectionIds: policy.sectionIds,
    translations: policy.translations,
  };
}

export async function GET(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, async () => {
    const { connection } = await settingsRequestContext(request, "settings:read");
    const policies = await getPolicyVersionModel(connection)
      .find()
      .sort({ documentType: 1, version: -1, createdAt: -1 })
      .limit(100)
      .lean()
      .exec();
    return apiSuccess(policies.map(policySnapshot));
  });
}

export async function PATCH(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await settingsRequestContext(
      request,
      "settings:update-security",
      true,
    );
    const input = await parseJsonRequest(request, policyVersionContentSchema, validation);
    const policy = await createPolicyVersionDraft(connection, input, actor.id);
    await recordAuditEvent(connection, {
      action: "settings.section.update",
      actor: {
        kind: "admin",
        ref: actor.id,
        snapshot: { displayName: actor.displayName, role: actor.role },
      },
      resource: {
        kind: "policy-version",
        ref: policy._id.toHexString(),
        snapshot: {
          code: `${policy.documentType}:${policy.version}`,
          label: policy.documentType,
          status: "draft",
        },
      },
      outcome: "success",
      requestId,
      context: {
        settingsAction: "create-policy-draft",
        sectionKey: "terms",
        policyDocumentType: policy.documentType,
        policyVersion: policy.version,
      },
      network: { policy: "omitted", ipHash: null, ipAddress: null },
      userAgent: request.headers.get("user-agent"),
    });
    return apiSuccess(policySnapshot(policy), { status: 201 });
  });
}
