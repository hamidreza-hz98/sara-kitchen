import type { NextRequest } from "next/server";
import { revalidateDashboardFromRoute } from "@/server/cache/dashboard-revalidation";

import { connectToDatabase, MongoTransactionUnavailableError } from "@/server/database";
import { getServerEnvironment } from "@/server/environment";
import { ApiError, apiSuccess, handleApiRoute } from "@/server/http";
import { applyVerifiedPaymentStateToOrder } from "@/server/modules/orders";
import {
  acceptVerifiedMbWayWebhook,
  MBWAY_SANDBOX_WEBHOOK_MAX_BYTES,
  PaymentWebhookConflictError,
  PaymentWebhookUnmatchedError,
  verifyAndParseMbWaySandboxWebhook,
} from "@/server/modules/transactions";

export const runtime = "nodejs";

async function readRawBody(request: Request): Promise<string | null> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && Number(declaredLength) > MBWAY_SANDBOX_WEBHOOK_MAX_BYTES) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MBWAY_SANDBOX_WEBHOOK_MAX_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    // This adapter authenticates only our local simulator, not a real MB Way acquirer.
    if (process.env.NODE_ENV === "production") throw ApiError.notFound();
    const environment = getServerEnvironment();
    if (!environment.MBWAY_WEBHOOK_SECRET) throw ApiError.serviceUnavailable();
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      throw ApiError.authorization();
    }
    const rawBody = await readRawBody(request);
    const event =
      rawBody === null
        ? null
        : verifyAndParseMbWaySandboxWebhook({
            rawBody,
            signature: request.headers.get("x-mbway-signature"),
            timestamp: request.headers.get("x-mbway-timestamp"),
            secret: environment.MBWAY_WEBHOOK_SECRET,
          });
    if (!event) throw ApiError.authorization();

    try {
      const connection = await connectToDatabase();
      const outcome = await acceptVerifiedMbWayWebhook(connection, event, {
        onApplied: (session, state) =>
          applyVerifiedPaymentStateToOrder(connection, state, session, requestId).then(
            () => undefined,
          ),
      });
      if (outcome === "applied") revalidateDashboardFromRoute();
      return apiSuccess({ accepted: true, outcome });
    } catch (error) {
      if (error instanceof PaymentWebhookConflictError) throw ApiError.conflict();
      if (
        error instanceof PaymentWebhookUnmatchedError ||
        error instanceof MongoTransactionUnavailableError
      ) {
        throw ApiError.serviceUnavailable();
      }
      throw error;
    }
  });
}
