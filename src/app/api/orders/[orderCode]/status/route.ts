import type { NextRequest } from "next/server";

import {
  ApiError,
  apiSuccess,
  handleApiRoute,
  parseJsonRequest,
  parseRouteParameters,
} from "@/server/http";
import {
  createOrderManagement,
  orderCodeParametersSchema,
  orderTransitionSchema,
} from "@/server/modules/orders";

import { orderRequestContext, translateOrderError } from "../../route-helper";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ orderCode: string }> };

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await orderRequestContext(
      request,
      "orders:update",
      true,
    );
    const [{ orderCode }, input] = await Promise.all([
      parseRouteParameters(context.params, orderCodeParametersSchema, validation),
      parseJsonRequest(request, orderTransitionSchema, validation),
    ]);
    if (input.status === "cancelled")
      throw ApiError.validation([
        {
          code: "use_cancel_action",
          message: "Use the cancellation action for this status.",
          path: ["status"],
        },
      ]);
    try {
      return apiSuccess(
        await createOrderManagement(connection, {
          requestId,
          userAgent: request.headers.get("user-agent"),
        }).transition({ id: actor.id, role: actor.role, active: true }, orderCode, input),
      );
    } catch (error) {
      return translateOrderError(error);
    }
  });
}
