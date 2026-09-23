import type { NextRequest } from "next/server";

import { apiSuccess, handleApiRoute, parseJsonRequest, parseRouteParameters } from "@/server/http";
import { dishEmptyMutationSchema, dishIdParametersSchema } from "@/server/modules/dishes";

import {
  dishAdminRequestContext,
  resolveDishServices,
  translateDishError,
} from "../../../route-helper";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ dishId: string }> };

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await dishAdminRequestContext(
      request,
      "dishes:delete",
      true,
    );
    const [{ dishId }] = await Promise.all([
      parseRouteParameters(context.params, dishIdParametersSchema, validation),
      parseJsonRequest(request, dishEmptyMutationSchema, validation),
    ]);
    try {
      return apiSuccess(
        await resolveDishServices(connection, requestId).restore(
          { id: actor.id, role: actor.role },
          dishId,
        ),
      );
    } catch (error) {
      return translateDishError(error);
    }
  });
}
