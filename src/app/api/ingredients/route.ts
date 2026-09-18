import type { NextRequest } from "next/server";

import { pageResult } from "@/server/database";
import { apiSuccess, handleApiRoute, parseJsonRequest, parseQueryParameters } from "@/server/http";
import {
  ingredientCreateSchema,
  ingredientListQuerySchema,
  type IngredientInput,
} from "@/server/modules/ingredients";

import {
  ingredientRequestContext,
  resolveIngredientServices,
  translateIngredientServiceError,
} from "./route-helper";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await ingredientRequestContext(
      request,
      "ingredients:read",
    );
    const query = parseQueryParameters(request, ingredientListQuerySchema, validation);
    try {
      const result = await resolveIngredientServices(connection, requestId).list(
        { id: actor.id, role: actor.role },
        {
          page: query.page,
          pageSize: query.pageSize,
          ...(query.status ? { status: query.status } : {}),
          ...(query.allergen ? { allergen: query.allergen } : {}),
          ...(query.search ? { search: query.search } : {}),
          sortBy: query.sortBy,
          sortDirection: query.sortDirection,
        },
      );
      const page = pageResult(result.items, result.total, {
        page: query.page,
        pageSize: query.pageSize,
        sortBy: query.sortBy,
        sortDirection: query.sortDirection,
      });
      return apiSuccess(page.data, { meta: page.meta });
    } catch (error) {
      return translateIngredientServiceError(error);
    }
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await ingredientRequestContext(
      request,
      "ingredients:create",
      true,
    );
    const input = await parseJsonRequest(request, ingredientCreateSchema, validation);
    try {
      return apiSuccess(
        await resolveIngredientServices(connection, requestId).create(
          { id: actor.id, role: actor.role },
          input as IngredientInput,
        ),
        { status: 201 },
      );
    } catch (error) {
      return translateIngredientServiceError(error);
    }
  });
}
