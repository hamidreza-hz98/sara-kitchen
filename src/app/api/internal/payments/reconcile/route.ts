import { timingSafeEqual } from "node:crypto";

import type { NextRequest } from "next/server";

import { connectToDatabase } from "@/server/database";
import { getServerEnvironment } from "@/server/environment";
import { ApiError, apiSuccess, handleApiRoute } from "@/server/http";
import { applyVerifiedPaymentStateToOrder } from "@/server/modules/orders";
import { getLocalMbWaySandboxProvider, reconcilePayments } from "@/server/modules/transactions";
import { createApplicationLogger } from "@/server/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: NextRequest, expected: string | undefined): boolean {
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/iu, "") ?? "";
  if (!expected || supplied.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

/** Invoke every five minutes from the deployment scheduler. Never expose this route publicly. */
export async function POST(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const environment = getServerEnvironment();
    if (!authorized(request, environment.PAYMENT_RECONCILIATION_CRON_SECRET)) {
      throw ApiError.authentication();
    }
    if (
      process.env.NODE_ENV === "production" ||
      !environment.MBWAY_ENABLED ||
      !environment.MBWAY_WEBHOOK_SECRET
    ) {
      throw ApiError.serviceUnavailable("No approved payment provider is configured.");
    }
    const connection = await connectToDatabase();
    const logger = createApplicationLogger({ module: "payment-reconciliation", requestId });
    const provider = getLocalMbWaySandboxProvider(environment.MBWAY_WEBHOOK_SECRET);
    const summary = await reconcilePayments(
      connection,
      (providerId) => (providerId === provider.id ? provider : null),
      (session, state) =>
        applyVerifiedPaymentStateToOrder(connection, state, session, requestId).then(
          () => undefined,
        ),
      {
        requestId,
        onAlert(alert) {
          logger.error({
            action: "payment.reconciliation.alert",
            context: alert,
            message: "Payment reconciliation needs operator attention.",
          });
        },
      },
    );
    logger.info({
      action: "payment.reconciliation.completed",
      context: summary,
      message: "Payment reconciliation pass completed.",
    });
    return apiSuccess(summary, { headers: { "Cache-Control": "private, no-store" } });
  });
}
