import type { NextRequest } from "next/server";
import { z } from "zod";

import {
  apiSuccess,
  getRequestValidationOptions,
  handleApiRoute,
  parseJsonRequest,
} from "@/server/http";
import { CART_MAX_QUANTITY_PER_LINE } from "@/server/modules/carts";

import {
  appendGuestCookie,
  cartRequestContext,
  resolveCartCrud,
  translateCartError,
} from "../route-helper";

export const runtime = "nodejs";

const addSchema = z.strictObject({
  dishId: z.string().regex(/^[a-f\d]{24}$/iu),
  expectedVersion: z.number().int().min(1).nullable(),
  quantity: z.number().int().min(1).max(CART_MAX_QUANTITY_PER_LINE),
});

export async function POST(request: NextRequest): Promise<Response> {
  let issuedGuestToken: string | null = null;
  const response = await handleApiRoute(request, async ({ requestId }) => {
    const input = await parseJsonRequest(
      request,
      addSchema,
      await getRequestValidationOptions("en"),
    );
    const context = await cartRequestContext(request, { createGuest: true, mutation: true });
    issuedGuestToken = context.issuedGuestToken;
    if (!context.identity) throw new Error("Cart identity creation failed.");
    const service = resolveCartCrud(
      context.connection,
      requestId,
      request.headers.get("user-agent"),
    );
    try {
      const current = await service.create(context.identity);
      return apiSuccess(
        await service.addItem(
          context.identity,
          input.expectedVersion ?? current.cart.version,
          input.dishId,
          input.quantity,
        ),
      );
    } catch (error) {
      return translateCartError(error);
    }
  });
  return appendGuestCookie(response, issuedGuestToken);
}
