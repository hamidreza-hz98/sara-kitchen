import type { NextRequest } from "next/server";

import {
  apiSuccess,
  handleApiRoute,
  parseQueryParameters,
  parseRouteParameters,
} from "@/server/http";
import { dishDetailQuerySchema, dishSlugParametersSchema } from "@/server/modules/dishes";

import {
  DISH_PUBLIC_CACHE_CONTROL,
  dishPublicRequestContext,
  publicDishQueryLocale,
  resolveDishCatalog,
  translateDishError,
} from "../route-helper";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ dishSlug: string }> };

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApiRoute(request, async () => {
    const { connection, locale, validation } = await dishPublicRequestContext(request, "detail");
    const [{ dishSlug }, query] = await Promise.all([
      parseRouteParameters(context.params, dishSlugParametersSchema, validation),
      parseQueryParameters(request, dishDetailQuerySchema, validation),
    ]);
    try {
      const detail = await resolveDishCatalog(connection).getBySlug({
        slug: dishSlug,
        locale: publicDishQueryLocale(query.locale, locale),
        ...(query.fallbackLocale !== undefined ? { fallbackLocale: query.fallbackLocale } : {}),
      });
      return apiSuccess(detail, {
        headers: { "cache-control": DISH_PUBLIC_CACHE_CONTROL, vary: "Cookie" },
      });
    } catch (error) {
      return translateDishError(error);
    }
  });
}
