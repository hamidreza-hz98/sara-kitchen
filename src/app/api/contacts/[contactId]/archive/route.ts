import type { NextRequest } from "next/server";

import { apiSuccess, handleApiRoute, parseJsonRequest, parseRouteParameters } from "@/server/http";
import { contactEmptyMutationSchema, contactIdParametersSchema } from "@/server/modules/contacts";

import {
  contactAdminRequestContext,
  resolveContactFlow,
  translateContactFlowError,
} from "../../route-helper";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ contactId: string }> };

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await contactAdminRequestContext(
      request,
      "contacts:update",
      true,
    );
    const [{ contactId }] = await Promise.all([
      parseRouteParameters(context.params, contactIdParametersSchema, validation),
      parseJsonRequest(request, contactEmptyMutationSchema, validation),
    ]);
    try {
      return apiSuccess(
        await resolveContactFlow(connection, requestId, request.headers.get("user-agent")).archive(
          { id: actor.id, role: actor.role },
          contactId,
        ),
      );
    } catch (error) {
      return translateContactFlowError(error);
    }
  });
}
