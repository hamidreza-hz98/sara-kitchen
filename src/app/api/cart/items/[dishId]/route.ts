import type { NextRequest } from "next/server";
import { z } from "zod";

import {
  ApiError,
  apiSuccess,
  getRequestValidationOptions,
  handleApiRoute,
  parseJsonRequest,
  parseRouteParameters,
} from "@/server/http";
import { CART_MAX_QUANTITY_PER_LINE } from "@/server/modules/carts";

import {
  cartClientProjection,
  cartRequestContext,
  cartRequestLocale,
  resolveCartCrud,
  translateCartError,
} from "../../route-helper";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ dishId: string }> };
const parametersSchema = z.strictObject({ dishId: z.string().regex(/^[a-f\d]{24}$/iu) });
const mutationSchema = z.strictObject({
  expectedVersion: z.number().int().min(1),
  quantity: z.number().int().min(1).max(CART_MAX_QUANTITY_PER_LINE).optional(),
});

async function mutationContext(request: NextRequest, context: RouteContext) {
  const validation = await getRequestValidationOptions("en");
  const [parameters, input] = await Promise.all([
    parseRouteParameters(context.params, parametersSchema, validation),
    parseJsonRequest(request, mutationSchema, validation),
  ]);
  const cart = await cartRequestContext(request, { createGuest: false, mutation: true });
  if (!cart.identity) throw ApiError.notFound("cart");
  return { cart, input, parameters };
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { cart, input, parameters } = await mutationContext(request, context);
    if (input.quantity === undefined) {
      throw ApiError.validation([
        { code: "required", message: "Quantity is required.", path: ["quantity"] },
      ]);
    }
    const identity = cart.identity;
    if (!identity) throw ApiError.notFound("cart");
    try {
      const result = await resolveCartCrud(
        cart.connection,
        requestId,
        request.headers.get("user-agent"),
      ).updateQuantity(identity, input.expectedVersion, parameters.dishId, input.quantity);
      return apiSuccess(
        await cartClientProjection(cart.connection, result, cartRequestLocale(request)),
      );
    } catch (error) {
      return translateCartError(error);
    }
  });
}

export async function DELETE(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { cart, input, parameters } = await mutationContext(request, context);
    const identity = cart.identity;
    if (!identity) throw ApiError.notFound("cart");
    try {
      const result = await resolveCartCrud(
        cart.connection,
        requestId,
        request.headers.get("user-agent"),
      ).removeItem(identity, input.expectedVersion, parameters.dishId);
      return apiSuccess(
        await cartClientProjection(cart.connection, result, cartRequestLocale(request)),
      );
    } catch (error) {
      return translateCartError(error);
    }
  });
}
