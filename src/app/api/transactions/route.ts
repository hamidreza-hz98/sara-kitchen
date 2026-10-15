import type { NextRequest } from "next/server";

import { pageResult } from "@/server/database";
import { apiSuccess, handleApiRoute, parseQueryParameters } from "@/server/http";
import {
  createTransactionManagement,
  transactionListQuerySchema,
} from "@/server/modules/transactions";

import { transactionRequestContext, translateTransactionError } from "./route-helper";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await transactionRequestContext(
      request,
      "transactions:read",
    );
    const query = parseQueryParameters(request, transactionListQuerySchema, validation);
    try {
      const result = await createTransactionManagement(connection, {
        requestId,
        userAgent: request.headers.get("user-agent"),
      }).list(
        { id: actor.id, role: actor.role, active: true },
        {
          page: query.page,
          pageSize: query.pageSize,
          sortDirection: query.sortDirection,
          ...(query.status ? { status: query.status } : {}),
          ...(query.method ? { method: query.method } : {}),
          ...(query.provider ? { provider: query.provider } : {}),
          ...(query.customerId ? { customerId: query.customerId } : {}),
          ...(query.orderId ? { orderId: query.orderId } : {}),
        },
      );
      const page = pageResult(result.items, result.total, {
        page: query.page,
        pageSize: query.pageSize,
        sortBy: "createdAt",
        sortDirection: query.sortDirection,
      });
      return apiSuccess(page.data, {
        meta: page.meta,
        headers: { "Cache-Control": "private, no-store" },
      });
    } catch (error) {
      return translateTransactionError(error);
    }
  });
}
