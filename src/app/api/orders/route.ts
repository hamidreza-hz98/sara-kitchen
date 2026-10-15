import type { NextRequest } from "next/server";

import { pageResult } from "@/server/database";
import { apiSuccess, handleApiRoute, parseQueryParameters } from "@/server/http";
import { createOrderManagement, orderListQuerySchema } from "@/server/modules/orders";

import { orderRequestContext, translateOrderError } from "./route-helper";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await orderRequestContext(request, "orders:read");
    const query = parseQueryParameters(request, orderListQuerySchema, validation);
    try {
      const result = await createOrderManagement(connection, {
        requestId,
        userAgent: request.headers.get("user-agent"),
      }).list(
        { id: actor.id, role: actor.role, active: true },
        {
          page: query.page,
          pageSize: query.pageSize,
          sortDirection: query.sortDirection,
          ...(query.status ? { status: query.status } : {}),
          ...(query.customerId ? { customerId: query.customerId } : {}),
          ...(query.search ? { search: query.search } : {}),
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
      return translateOrderError(error);
    }
  });
}
