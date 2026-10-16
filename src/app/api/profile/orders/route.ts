import type { NextRequest } from "next/server";

import { apiSuccess, handleApiRoute, parseQueryParameters } from "@/server/http";
import { customerOrderListQuerySchema, listCustomerOrders } from "@/server/modules/orders";

import { customerSelfRequestContext } from "../../customers/route-helper";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, async () => {
    const { connection, actor, validation } = await customerSelfRequestContext(request);
    const query = parseQueryParameters(request, customerOrderListQuerySchema, validation);
    const page = await listCustomerOrders(connection, {
      customerId: actor.id,
      tab: query.tab,
      page: query.page,
      pageSize: 8,
      ...(query.status ? { status: query.status } : {}),
    });
    return apiSuccess(page, { headers: { "Cache-Control": "private, no-store" } });
  });
}
