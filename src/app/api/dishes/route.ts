import type { NextRequest } from "next/server";

import { apiSuccess, handleApiRoute, parseJsonRequest, parseQueryParameters } from "@/server/http";
import {
  dishCatalogQuerySchema,
  dishCreateSchema,
  type DishCatalogQueryInput,
  type DishInput,
} from "@/server/modules/dishes";

import {
  DISH_PUBLIC_CACHE_CONTROL,
  dishAdminRequestContext,
  dishPublicRequestContext,
  publicDishQueryLocale,
  resolveDishCatalog,
  resolveDishServices,
  translateDishError,
} from "./route-helper";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, async () => {
    const { connection, locale, validation } = await dishPublicRequestContext(request, "catalog");
    const query = parseQueryParameters(request, dishCatalogQuerySchema, validation);
    try {
      const result = await resolveDishCatalog(connection).list({
        ...(query as DishCatalogQueryInput),
        locale: publicDishQueryLocale(query.locale, locale),
      });
      return apiSuccess(result.items, {
        meta: result.meta,
        headers: { "cache-control": DISH_PUBLIC_CACHE_CONTROL, vary: "Cookie" },
      });
    } catch (error) {
      return translateDishError(error);
    }
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await dishAdminRequestContext(
      request,
      "dishes:create",
      true,
    );
    const input = await parseJsonRequest(request, dishCreateSchema, validation);
    try {
      return apiSuccess(
        await resolveDishServices(connection, requestId).create(
          { id: actor.id, role: actor.role },
          input as DishInput,
        ),
        { status: 201 },
      );
    } catch (error) {
      return translateDishError(error);
    }
  });
}
