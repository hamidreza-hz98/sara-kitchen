import type { NextRequest } from "next/server";

import { apiSuccess, handleApiRoute } from "@/server/http";

import { cartRequestContext, resolveCartCrud, translateCartError } from "./route-helper";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const context = await cartRequestContext(request, { createGuest: false, mutation: false });
    if (!context.identity) return apiSuccess(null);
    try {
      return apiSuccess(
        await resolveCartCrud(context.connection, requestId, request.headers.get("user-agent")).get(
          context.identity,
        ),
      );
    } catch (error) {
      return translateCartError(error);
    }
  });
}
