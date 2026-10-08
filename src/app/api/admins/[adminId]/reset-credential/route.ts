import type { NextRequest } from "next/server";

import { apiSuccess, handleApiRoute, parseJsonRequest, parseRouteParameters } from "@/server/http";
import { adminCredentialResetSchema, adminIdParametersSchema } from "@/server/modules/admins";

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
      "admins:update",
      true,
    );
    const [{ adminId }, input] = await Promise.all([
      parseRouteParameters(context.params, adminIdParametersSchema, validation),
      parseJsonRequest(request, adminCredentialResetSchema, validation),
    ]);
    try {
      return apiSuccess(
        await resolveAdminCrudServices(connection, requestId).resetCredential(
          { id: actor.id, role: actor.role },
          adminId,
          input.password,
        ),
      );
    } catch (error) {
      return translateAdminCrudError(error);
    }
  });
}
