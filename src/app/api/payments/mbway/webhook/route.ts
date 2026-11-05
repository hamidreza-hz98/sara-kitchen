import type { NextRequest } from "next/server";
import { revalidateDashboardFromRoute } from "@/server/cache/dashboard-revalidation";

import { connectToDatabase, MongoTransactionUnavailableError } from "@/server/database";
import { getServerEnvironment } from "@/server/environment";
import { apiRawSuccess, ApiError, handleApiRoute } from "@/server/http";
import { applyVerifiedPaymentStateToOrder } from "@/server/modules/orders";
import {
  acceptVerifiedMbWayWebhook,
  createConfiguredSibsMbWaySandboxProvider,
  MBWAY_SANDBOX_WEBHOOK_MAX_BYTES,
  PaymentWebhookConflictError,
  PaymentWebhookUnmatchedError,
} from "@/server/modules/transactions";

export const runtime = "nodejs";

async function readEncryptedBody(request: Request): Promise<string | null> {
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
    return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)).trim();
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const environment = getServerEnvironment();
    if (!environment.MBWAY_ENABLED) throw ApiError.notFound();
    const provider = createConfiguredSibsMbWaySandboxProvider(environment);
    const rawBody = await readEncryptedBody(request);
    const event =
      rawBody === null
        ? null
        : await provider.verifyWebhook({
            rawBody,
            signature: null,
            timestamp: null,
            receivedAt: new Date(),
            initializationVector: request.headers.get("x-initialization-vector"),
            authenticationTag: request.headers.get("x-authentication-tag"),
          });
    if (!event) throw ApiError.authorization();

    const normalizedEvent = {
      paymentId: event.providerPaymentId,
      eventId: event.providerEventId,
      code: event.code as
        "PENDING" | "AUTHORIZED" | "PAID" | "FAILED" | "CANCELLED" | "EXPIRED" | "REFUNDED",
      amountCents: event.amountCents,
      responseCode: event.responseCode,
      occurredAt: event.occurredAt,
    };

    try {
      const connection = await connectToDatabase();
      const outcome = await acceptVerifiedMbWayWebhook(connection, normalizedEvent, {
        onApplied: (session, state) =>
          applyVerifiedPaymentStateToOrder(connection, state, session, requestId).then(
            () => undefined,
          ),
      });
      if (outcome === "applied") revalidateDashboardFromRoute();
      return apiRawSuccess(
        {
          statusCode: "000",
          statusMsg: "Success",
          notificationID: event.providerEventId,
        },
        { headers: { "Content-Type": "application/json; charset=utf-8" } },
      );
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
