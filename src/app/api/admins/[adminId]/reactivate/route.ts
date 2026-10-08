import type { NextRequest } from "next/server";

import { apiSuccess, handleApiRoute, parseJsonRequest, parseRouteParameters } from "@/server/http";
import { adminEmptyMutationSchema, adminIdParametersSchema } from "@/server/modules/admins";

import {
  adminRequestContext,
  resolveAdminCrudServices,
  translateAdminCrudError,
} from "../../route-helper";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ adminId: string }> };

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await adminRequestContext(
      request,
      "admins:disable",
      true,
    );
    const [{ adminId }] = await Promise.all([
      parseRouteParameters(context.params, adminIdParametersSchema, validation),
      parseJsonRequest(request, adminEmptyMutationSchema, validation),
    ]);
    try {
      return apiSuccess(
        await resolveAdminCrudServices(connection, requestId).reactivate(
          { id: actor.id, role: actor.role },
          adminId,
        ),
      );
    } catch (error) {
      return translateAdminCrudError(error);
    }
  });
}
