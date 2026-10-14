import type { NextRequest } from "next/server";

import { apiSuccess, handleApiRoute } from "@/server/http";

import {
  cartRecommendationProjection,
  cartRequestContext,
  cartRequestLocale,
  resolveCartCrud,
  translateCartError,
} from "../route-helper";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const context = await cartRequestContext(request, { createGuest: false, mutation: false });
    if (!context.identity) return apiSuccess({ degraded: false, items: [] });
    try {
      const result = await resolveCartCrud(
        context.connection,
        requestId,
        request.headers.get("user-agent"),
      ).get(context.identity);
      return apiSuccess(
        result
          ? await cartRecommendationProjection(
              context.connection,
              result.cart.lines.map(({ dishId }) => dishId),
              cartRequestLocale(request),
            )
          : { degraded: false, items: [] },
      );
    } catch (error) {
      return translateCartError(error);
    }
  });
}
