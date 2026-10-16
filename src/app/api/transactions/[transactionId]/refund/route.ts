import type { NextRequest } from "next/server";
import { revalidateDashboardFromRoute } from "@/server/cache/dashboard-revalidation";

import { apiSuccess, handleApiRoute, parseJsonRequest, parseRouteParameters } from "@/server/http";
import { applyVerifiedPaymentStateToOrder } from "@/server/modules/orders";
import {
  createTransactionManagement,
  transactionIdParametersSchema,
  transactionRefundSchema,
} from "@/server/modules/transactions";

import {
  localPaymentProvider,
  transactionActionKey,
  transactionRequestContext,
  translateTransactionError,
} from "../../route-helper";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ transactionId: string }> };

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await transactionRequestContext(
      request,
      "transactions:refund",
      true,
    );
    const [{ transactionId }, input] = await Promise.all([
      parseRouteParameters(context.params, transactionIdParametersSchema, validation),
      parseJsonRequest(request, transactionRefundSchema, validation),
    ]);
    const key = transactionActionKey(request);
    try {
      const result = await createTransactionManagement(connection, {
        requestId,
        userAgent: request.headers.get("user-agent"),
      }).refund(
        { id: actor.id, role: actor.role, active: true },
        transactionId,
        localPaymentProvider(),
        { ...input, idempotencyKey: key },
        (session, state) =>
          applyVerifiedPaymentStateToOrder(connection, state, session, requestId).then(
            () => undefined,
          ),
      );
      revalidateDashboardFromRoute();
      return apiSuccess(result, { headers: { "Cache-Control": "private, no-store" } });
    } catch (error) {
      return translateTransactionError(error);
    }
  });
}
