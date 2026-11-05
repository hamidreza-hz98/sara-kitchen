import type { NextRequest } from "next/server";

import { ApiError, apiSuccess, handleApiRoute, parseQueryParameters } from "@/server/http";
import { getServerEnvironment } from "@/server/environment";
import { applyVerifiedPaymentStateToOrder } from "@/server/modules/orders";
import {
  createConfiguredSibsMbWaySandboxProvider,
  createTransactionManagement,
} from "@/server/modules/transactions";
import {
  getCustomerPaymentResult,
  paymentResultQuerySchema,
  PaymentResultError,
} from "@/server/modules/orders";

import { customerSelfRequestContext } from "../../customers/route-helper";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await customerSelfRequestContext(request);
    const query = parseQueryParameters(request, paymentResultQuerySchema, validation);
    try {
      const environment = getServerEnvironment();
      const provider = environment.MBWAY_ENABLED
        ? createConfiguredSibsMbWaySandboxProvider(environment)
        : null;
      return apiSuccess(
        await getCustomerPaymentResult(
          connection,
          actor.id,
          query.order,
          provider
            ? (transactionId) =>
                createTransactionManagement(connection, {
                  requestId,
                  userAgent: request.headers.get("user-agent"),
                })
                  .reconcile({ kind: "system" }, transactionId, provider, (session, state) =>
                    applyVerifiedPaymentStateToOrder(connection, state, session, requestId).then(
                      () => undefined,
                    ),
                  )
                  .then(() => undefined)
            : undefined,
        ),
        {
          headers: { "Cache-Control": "private, no-store" },
        },
      );
    } catch (error) {
      if (error instanceof PaymentResultError) throw ApiError.notFound("payment result");
      throw error;
    }
  });
}
