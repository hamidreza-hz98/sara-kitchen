import type { NextRequest } from "next/server";

import { apiSuccess, handleApiRoute, parseJsonRequest, parseRouteParameters } from "@/server/http";
import {
  ingredientIdParametersSchema,
  ingredientUpdateSchema,
  type IngredientUpdate,
} from "@/server/modules/ingredients";

import {
  ingredientRequestContext,
  resolveIngredientServices,
  translateIngredientServiceError,
} from "../route-helper";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ ingredientId: string }> };

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await ingredientRequestContext(
      request,
      "ingredients:read",
    );
    const { ingredientId } = await parseRouteParameters(
      context.params,
      ingredientIdParametersSchema,
      validation,
    );
    try {
      return apiSuccess(
        await resolveIngredientServices(connection, requestId).get(
          { id: actor.id, role: actor.role },
          ingredientId,
        ),
      );
    } catch (error) {
      return translateIngredientServiceError(error);
    }
  });
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await ingredientRequestContext(
      request,
      "ingredients:update",
      true,
    );
    const [{ ingredientId }, update] = await Promise.all([
      parseRouteParameters(context.params, ingredientIdParametersSchema, validation),
      parseJsonRequest(request, ingredientUpdateSchema, validation),
    ]);
    try {
      return apiSuccess(
        await resolveIngredientServices(connection, requestId).update(
          { id: actor.id, role: actor.role },
          ingredientId,
          update as IngredientUpdate,
        ),
      );
    } catch (error) {
      return translateIngredientServiceError(error);
    }
  });
}

export async function DELETE(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await ingredientRequestContext(
      request,
      "ingredients:delete",
      true,
    );
    const { ingredientId } = await parseRouteParameters(
      context.params,
      ingredientIdParametersSchema,
      validation,
    );
    try {
      return apiSuccess(
        await resolveIngredientServices(connection, requestId).delete(
          { id: actor.id, role: actor.role },
          ingredientId,
        ),
      );
    } catch (error) {
      return translateIngredientServiceError(error);
    }
  });
}
