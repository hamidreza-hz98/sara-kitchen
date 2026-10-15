import type { NextRequest } from "next/server";

import { apiSuccess, handleApiRoute, parseJsonRequest, parseRouteParameters } from "@/server/http";
import {
  createTransactionManagement,
  transactionIdParametersSchema,
  transactionNoteSchema,
} from "@/server/modules/transactions";

import { transactionRequestContext, translateTransactionError } from "../route-helper";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ transactionId: string }> };

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await transactionRequestContext(
      request,
      "transactions:read",
    );
    const { transactionId } = await parseRouteParameters(
      context.params,
      transactionIdParametersSchema,
      validation,
    );
    try {
      return apiSuccess(
        await createTransactionManagement(connection, {
          requestId,
          userAgent: request.headers.get("user-agent"),
        }).get({ id: actor.id, role: actor.role, active: true }, transactionId),
        { headers: { "Cache-Control": "private, no-store" } },
      );
    } catch (error) {
      return translateTransactionError(error);
    }
  });
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await transactionRequestContext(
      request,
      "transactions:reconcile",
      true,
    );
    const [{ transactionId }, input] = await Promise.all([
      parseRouteParameters(context.params, transactionIdParametersSchema, validation),
      parseJsonRequest(request, transactionNoteSchema, validation),
    ]);
    try {
      return apiSuccess(
        await createTransactionManagement(connection, {
          requestId,
          userAgent: request.headers.get("user-agent"),
        }).setInternalNote({ id: actor.id, role: actor.role, active: true }, transactionId, input),
      );
    } catch (error) {
      return translateTransactionError(error);
    }
  });
}
