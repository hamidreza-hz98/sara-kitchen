import type { NextRequest } from "next/server";
import { z } from "zod";

import { ApiError, apiSuccess, handleApiRoute, parseJsonRequest } from "@/server/http";
import { recordAuditEvent } from "@/server/modules/logs";
import { PolicyLifecycleError, releasePolicyVersion } from "@/server/modules/settings";

import { invalidateTermsSettings, settingsRequestContext } from "../../route-helper";

export const runtime = "nodejs";
const inputSchema = z.object({ policyVersionId: z.string().regex(/^[a-f\d]{24}$/iu) }).strict();

export async function POST(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await settingsRequestContext(
      request,
      "settings:update-security",
      true,
    );
    const { policyVersionId } = await parseJsonRequest(request, inputSchema, validation);
    try {
      const policy = await releasePolicyVersion(connection, policyVersionId);
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
            status: policy.state,
          },
        },
        outcome: "success",
        requestId,
        context: {
          settingsAction: "release-policy-version",
          sectionKey: "terms",
          policyDocumentType: policy.documentType,
          policyVersion: policy.version,
        },
        network: { policy: "omitted", ipHash: null, ipAddress: null },
        userAgent: request.headers.get("user-agent"),
      });
      invalidateTermsSettings();
      return apiSuccess({
        id: policy._id.toHexString(),
        state: policy.state,
        effectiveAt: policy.effectiveAt.toISOString(),
        publishedAt: policy.publishedAt?.toISOString() ?? null,
      });
    } catch (error) {
      if (error instanceof PolicyLifecycleError) {
        if (error.code === "policy_not_found") throw ApiError.notFound("policy_version");
        throw ApiError.conflict({ resource: "policy_version" });
      }
      throw error;
    }
  });
}
