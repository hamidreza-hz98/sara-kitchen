import type { NextRequest } from "next/server";

import { apiSuccess, handleApiRoute, parseJsonRequest, parseRouteParameters } from "@/server/http";
import {
  ingredientEmptyMutationSchema,
  ingredientIdParametersSchema,
} from "@/server/modules/ingredients";

import {
  ingredientRequestContext,
  resolveIngredientServices,
  translateIngredientServiceError,
} from "../../route-helper";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ ingredientId: string }> };

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await ingredientRequestContext(
      request,
      "ingredients:delete",
      true,
    );
    const [{ ingredientId }] = await Promise.all([
      parseRouteParameters(context.params, ingredientIdParametersSchema, validation),
      parseJsonRequest(request, ingredientEmptyMutationSchema, validation),
    ]);
    try {
      return apiSuccess(
        await resolveIngredientServices(connection, requestId).restore(
          { id: actor.id, role: actor.role },
          ingredientId,
        ),
      );
    } catch (error) {
      return translateIngredientServiceError(error);
    }
  });
}
