import type { NextRequest } from "next/server";

import { apiSuccess, handleApiRoute, parseJsonRequest, parseRouteParameters } from "@/server/http";
import { dishIdParametersSchema, dishUpdateSchema, type DishUpdate } from "@/server/modules/dishes";

import {
  dishAdminRequestContext,
  resolveDishServices,
  translateDishError,
} from "../../route-helper";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ dishId: string }> };

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await dishAdminRequestContext(request, "dishes:read");
    const { dishId } = await parseRouteParameters(
      context.params,
      dishIdParametersSchema,
      validation,
    );
    try {
      return apiSuccess(
        await resolveDishServices(connection, requestId).get(
          { id: actor.id, role: actor.role },
          dishId,
        ),
      );
    } catch (error) {
      return translateDishError(error);
    }
  });
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await dishAdminRequestContext(
      request,
      "dishes:update",
      true,
    );
    const [{ dishId }, update] = await Promise.all([
      parseRouteParameters(context.params, dishIdParametersSchema, validation),
      parseJsonRequest(request, dishUpdateSchema, validation),
    ]);
    try {
      return apiSuccess(
        await resolveDishServices(connection, requestId).update(
          { id: actor.id, role: actor.role },
          dishId,
          update as DishUpdate,
        ),
      );
    } catch (error) {
      return translateDishError(error);
    }
  });
}
