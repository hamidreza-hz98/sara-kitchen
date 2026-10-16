import type { NextRequest } from "next/server";
import { revalidateDashboardFromRoute } from "@/server/cache/dashboard-revalidation";

import { apiSuccess, handleApiRoute, parseJsonRequest, parseRouteParameters } from "@/server/http";
import {
  createOrderManagement,
  orderCancelSchema,
  orderCodeParametersSchema,
} from "@/server/modules/orders";

import { orderRequestContext, translateOrderError } from "../../route-helper";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ orderCode: string }> };

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await orderRequestContext(
      request,
      "orders:cancel",
      true,
    );
    const [{ orderCode }, input] = await Promise.all([
      parseRouteParameters(context.params, orderCodeParametersSchema, validation),
      parseJsonRequest(request, orderCancelSchema, validation),
    ]);
    try {
      const result = await createOrderManagement(connection, {
        requestId,
        userAgent: request.headers.get("user-agent"),
      }).transition({ id: actor.id, role: actor.role, active: true }, orderCode, {
        ...input,
        status: "cancelled",
      });
      revalidateDashboardFromRoute();
      return apiSuccess(result);
    } catch (error) {
      return translateOrderError(error);
    }
  });
}
