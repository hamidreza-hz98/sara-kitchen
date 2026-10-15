import type { NextRequest } from "next/server";

import { LOCALE_COOKIE_NAME, resolveLocalePreference } from "@/locales/routing";
import { connectToDatabase } from "@/server/database";
import {
  ApiError,
  apiSuccess,
  getRequestValidationOptions,
  handleApiRoute,
  parseJsonRequest,
  parseRouteParameters,
} from "@/server/http";
import {
  AuthorizationGuardError,
  customerCookieName,
  isProtectedMutation,
  requireCustomerActor,
} from "@/server/modules/auth";
import {
  createOrderManagement,
  orderCancelSchema,
  orderCodeParametersSchema,
} from "@/server/modules/orders";

import { translateOrderError } from "../../../../orders/route-helper";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ orderCode: string }> };

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const token = request.cookies.get(customerCookieName())?.value;
    if (!token) throw ApiError.authentication();
    if (!isProtectedMutation(request, "customer", token)) throw ApiError.authorization();
    const connection = await connectToDatabase();
    let actor;
    try {
      actor = await requireCustomerActor(connection, token);
    } catch (error) {
      if (error instanceof AuthorizationGuardError) throw ApiError.authentication();
      throw error;
    }
    const locale = resolveLocalePreference(request.cookies.get(LOCALE_COOKIE_NAME)?.value);
    const validation = await getRequestValidationOptions(locale);
    const [{ orderCode }, input] = await Promise.all([
      parseRouteParameters(context.params, orderCodeParametersSchema, validation),
      parseJsonRequest(request, orderCancelSchema, validation),
    ]);
    try {
      const result = await createOrderManagement(connection, {
        requestId,
        userAgent: request.headers.get("user-agent"),
      }).cancelCustomer(actor.id, orderCode, input);
      return apiSuccess(result, { headers: { "Cache-Control": "private, no-store" } });
    } catch (error) {
      return translateOrderError(error);
    }
  });
}
