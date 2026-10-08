import type { NextRequest } from "next/server";

import { apiSuccess, handleApiRoute, parseJsonRequest, parseRouteParameters } from "@/server/http";
import {
  adminIdParametersSchema,
  adminUpdateSchema,
  type AdminUpdateInput,
} from "@/server/modules/admins";

import {
  adminRequestContext,
  resolveAdminCrudServices,
  translateAdminCrudError,
} from "../route-helper";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ adminId: string }> };

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await adminRequestContext(request, "admins:read");
    const { adminId } = await parseRouteParameters(
      context.params,
      adminIdParametersSchema,
      validation,
    );
    try {
      return apiSuccess(
        await resolveAdminCrudServices(connection, requestId).get(
          { id: actor.id, role: actor.role },
          adminId,
        ),
      );
    } catch (error) {
      return translateAdminCrudError(error);
    }
  });
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await adminRequestContext(
      request,
      "admins:update",
      true,
    );
    const [{ adminId }, input] = await Promise.all([
      parseRouteParameters(context.params, adminIdParametersSchema, validation),
      parseJsonRequest(request, adminUpdateSchema, validation),
    ]);
    try {
      return apiSuccess(
        await resolveAdminCrudServices(connection, requestId).update(
          { id: actor.id, role: actor.role },
          adminId,
          input as AdminUpdateInput,
        ),
      );
    } catch (error) {
      return translateAdminCrudError(error);
    }
  });
}

export async function DELETE(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await adminRequestContext(
      request,
      "admins:delete",
      true,
    );
    const { adminId } = await parseRouteParameters(
      context.params,
      adminIdParametersSchema,
      validation,
    );
    try {
      return apiSuccess(
        await resolveAdminCrudServices(connection, requestId).delete(
          { id: actor.id, role: actor.role },
          adminId,
        ),
      );
    } catch (error) {
      return translateAdminCrudError(error);
    }
  });
}
