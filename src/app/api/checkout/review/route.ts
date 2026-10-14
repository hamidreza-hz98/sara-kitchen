import type { NextRequest } from "next/server";

import { apiSuccess, ApiError, handleApiRoute } from "@/server/http";
import { createAddressRepository } from "@/server/modules/addresses";
import { getCheckoutPolicies } from "@/server/modules/settings";

import {
  cartClientProjection,
  cartRequestContext,
  cartRequestLocale,
  resolveCartCrud,
  translateCartError,
} from "../../cart/route-helper";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const context = await cartRequestContext(request, { createGuest: false, mutation: false });
    if (context.identity?.kind !== "customer") throw ApiError.authentication();
    try {
      const result = await resolveCartCrud(
        context.connection,
        requestId,
        request.headers.get("user-agent"),
      ).get(context.identity);
      const address = result?.cart.selectedAddressId
        ? await createAddressRepository(context.connection).findOwnedById(
            context.identity.customerId,
            result.cart.selectedAddressId,
          )
        : null;
      const locale = cartRequestLocale(request);
      const policies = await getCheckoutPolicies(context.connection, locale);
      return apiSuccess(
        {
          cart: result ? await cartClientProjection(context.connection, result, locale) : null,
          address: address
            ? {
                id: address.id,
                name: address.name,
                recipientName: address.recipientName,
                recipientMobile: address.recipientMobile,
                formattedAddress: address.formattedAddress,
                postalCode: address.postalCode,
                deliveryNotes: address.deliveryNotes,
              }
            : null,
          policies,
          paymentMethods: [{ type: "mbway", enabled: false }],
          submissionAvailable: false,
        },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    } catch (error) {
      return translateCartError(error);
    }
  });
}
