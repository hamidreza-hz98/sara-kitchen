import type { NextRequest } from "next/server";

import { pageResult } from "@/server/database";
import { apiSuccess, handleApiRoute, parseQueryParameters } from "@/server/http";
import { customerListQuerySchema } from "@/server/modules/customers";

import {
  customerAdminRequestContext,
  customerOrderSummaries,
  resolveCustomerCrudServices,
  translateCustomerCrudError,
} from "./route-helper";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await customerAdminRequestContext(
      request,
      "customers:read",
    );
    const query = parseQueryParameters(request, customerListQuerySchema, validation);
    try {
      const result = await resolveCustomerCrudServices(connection, requestId).list(
        { kind: "admin", id: actor.id, role: actor.role },
        {
          page: query.page,
          pageSize: query.pageSize,
          ...(query.search ? { search: query.search } : {}),
          ...(query.status ? { status: query.status } : {}),
          sortBy: query.sortBy,
          sortDirection: query.sortDirection,
        },
      );
      const summaries = await customerOrderSummaries(
        connection,
        result.items.map((customer) => customer.id),
      );
      const page = pageResult(
        result.items.map((customer) => ({
          ...customer,
          summary: summaries[customer.id] ?? {
            orderCount: 0,
            totalSpentCents: 0,
            lastOrderAt: null,
          },
        })),
        result.total,
        query,
      );
      return apiSuccess(page.data, { meta: page.meta });
    } catch (error) {
      return translateCustomerCrudError(error);
    }
  });
}
