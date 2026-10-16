import type { NextRequest } from "next/server";
import { revalidateDashboardFromRoute } from "@/server/cache/dashboard-revalidation";

import { apiSuccess, handleApiRoute, parseJsonRequest, parseRouteParameters } from "@/server/http";
import {
  createOrderManagement,
  orderCodeParametersSchema,
  orderTransactionSchema,
} from "@/server/modules/orders";

import { orderRequestContext, translateOrderError } from "../../route-helper";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ orderCode: string }> };

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await orderRequestContext(
      request,
      "transactions:reconcile",
      true,
    );
    const [{ orderCode }, input] = await Promise.all([
      parseRouteParameters(context.params, orderCodeParametersSchema, validation),
      parseJsonRequest(request, orderTransactionSchema, validation),
    ]);
    try {
      const result = await createOrderManagement(connection, {
        requestId,
        userAgent: request.headers.get("user-agent"),
      }).attachTransaction({ id: actor.id, role: actor.role, active: true }, orderCode, input);
      revalidateDashboardFromRoute();
      return apiSuccess(result);
    } catch (error) {
      return translateOrderError(error);
    }
  });
}
