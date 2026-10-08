import type { NextRequest } from "next/server";

import {
  apiSuccess,
  consumeRequestRateLimit,
  handleApiRoute,
  parseJsonRequest,
} from "@/server/http";
import { isSameOriginMutation } from "@/server/modules/auth";
import { contactSubmissionInputSchema } from "@/server/modules/contacts";

import {
  contactPublicRequestContext,
  contactReferrerHost,
  resolveContactFlow,
  translateContactFlowError,
} from "../contacts/route-helper";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    if (!isSameOriginMutation(request)) {
      const { ApiError } = await import("@/server/http");
      throw ApiError.authorization();
    }
    const { connection, validation } = await contactPublicRequestContext(request);
    await consumeRequestRateLimit(connection, request, {
      scope: "contact-create",
      limit: 5,
      windowMs: 10 * 60 * 1_000,
    });
    const input = await parseJsonRequest(request, contactSubmissionInputSchema, validation);
    try {
      await resolveContactFlow(
        connection,
        requestId,
        request.headers.get("user-agent"),
      ).createPublic(input, {
        pagePath: input.pagePath ?? null,
        referrerHost: contactReferrerHost(request),
        campaign: input.campaign ?? null,
        requestId,
      });
      return apiSuccess({ accepted: true as const }, { status: 202 });
    } catch (error) {
      return translateContactFlowError(error);
    }
  });
}
