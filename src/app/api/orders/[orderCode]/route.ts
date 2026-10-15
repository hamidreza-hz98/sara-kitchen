import type { NextRequest } from "next/server";

import { apiSuccess, handleApiRoute, parseJsonRequest, parseRouteParameters } from "@/server/http";
import {
  createOrderManagement,
  orderCodeParametersSchema,
  orderInternalNoteSchema,
} from "@/server/modules/orders";

import { orderRequestContext, translateOrderError } from "../route-helper";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ orderCode: string }> };

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await orderRequestContext(request, "orders:read");
    const { orderCode } = await parseRouteParameters(
      context.params,
      orderCodeParametersSchema,
      validation,
    );
    try {
      const result = await createOrderManagement(connection, {
        requestId,
        userAgent: request.headers.get("user-agent"),
      }).get({ id: actor.id, role: actor.role, active: true }, orderCode);
      return apiSuccess(result, { headers: { "Cache-Control": "private, no-store" } });
    } catch (error) {
      return translateOrderError(error);
    }
  });
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await orderRequestContext(
      request,
      "orders:update",
      true,
    );
    const [{ orderCode }, input] = await Promise.all([
      parseRouteParameters(context.params, orderCodeParametersSchema, validation),
      parseJsonRequest(request, orderInternalNoteSchema, validation),
    ]);
    try {
      const result = await createOrderManagement(connection, {
        requestId,
        userAgent: request.headers.get("user-agent"),
      }).setInternalNote({ id: actor.id, role: actor.role, active: true }, orderCode, input);
      return apiSuccess(result, { headers: { "Cache-Control": "private, no-store" } });
    } catch (error) {
      return translateOrderError(error);
    }
  });
}
