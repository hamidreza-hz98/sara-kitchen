import type { NextRequest } from "next/server";

import { ApiError, apiSuccess, handleApiRoute, parseQueryParameters } from "@/server/http";
import {
  getCustomerPaymentResult,
  paymentResultQuerySchema,
  PaymentResultError,
} from "@/server/modules/orders";

import { customerSelfRequestContext } from "../../customers/route-helper";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, async () => {
    const { connection, actor, validation } = await customerSelfRequestContext(request);
    const query = parseQueryParameters(request, paymentResultQuerySchema, validation);
    try {
      return apiSuccess(await getCustomerPaymentResult(connection, actor.id, query.order), {
        headers: { "Cache-Control": "private, no-store" },
      });
    } catch (error) {
      if (error instanceof PaymentResultError) throw ApiError.notFound("payment result");
      throw error;
    }
  });
}
