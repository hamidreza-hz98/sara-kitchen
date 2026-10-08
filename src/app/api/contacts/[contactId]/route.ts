import type { NextRequest } from "next/server";

import { apiSuccess, handleApiRoute, parseJsonRequest, parseRouteParameters } from "@/server/http";
import { contactIdParametersSchema, contactWorkflowUpdateSchema } from "@/server/modules/contacts";

import {
  contactAdminRequestContext,
  resolveContactFlow,
  translateContactFlowError,
} from "../route-helper";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ contactId: string }> };

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await contactAdminRequestContext(
      request,
      "contacts:read",
    );
    const { contactId } = await parseRouteParameters(
      context.params,
      contactIdParametersSchema,
      validation,
    );
    try {
      return apiSuccess(
        await resolveContactFlow(connection, requestId, request.headers.get("user-agent")).get(
          { id: actor.id, role: actor.role },
          contactId,
        ),
      );
    } catch (error) {
      return translateContactFlowError(error);
    }
  });
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await contactAdminRequestContext(
      request,
      "contacts:update",
      true,
    );
    const [{ contactId }, update] = await Promise.all([
      parseRouteParameters(context.params, contactIdParametersSchema, validation),
      parseJsonRequest(request, contactWorkflowUpdateSchema, validation),
    ]);
    try {
      return apiSuccess(
        await resolveContactFlow(connection, requestId, request.headers.get("user-agent")).update(
          { id: actor.id, role: actor.role },
          contactId,
          {
            ...(update.status !== undefined ? { status: update.status } : {}),
            ...(update.assigneeAdminId !== undefined
              ? { assigneeAdminId: update.assigneeAdminId }
              : {}),
            ...(update.note !== undefined ? { note: update.note } : {}),
          },
        ),
      );
    } catch (error) {
      return translateContactFlowError(error);
    }
  });
}

export async function DELETE(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await contactAdminRequestContext(
      request,
      "contacts:delete",
      true,
    );
    const { contactId } = await parseRouteParameters(
      context.params,
      contactIdParametersSchema,
      validation,
    );
    try {
      return apiSuccess(
        await resolveContactFlow(connection, requestId, request.headers.get("user-agent")).remove(
          { id: actor.id, role: actor.role },
          contactId,
        ),
      );
    } catch (error) {
      return translateContactFlowError(error);
    }
  });
}
