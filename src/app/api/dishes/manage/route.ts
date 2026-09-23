import type { NextRequest } from "next/server";

import { pageResult } from "@/server/database";
import { apiSuccess, handleApiRoute, parseQueryParameters } from "@/server/http";
import { dishManagementListQuerySchema } from "@/server/modules/dishes";

import { dishAdminRequestContext, resolveDishServices, translateDishError } from "../route-helper";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await dishAdminRequestContext(request, "dishes:read");
    const query = parseQueryParameters(request, dishManagementListQuerySchema, validation);
    try {
      const result = await resolveDishServices(connection, requestId).list(
        { id: actor.id, role: actor.role },
        {
          page: query.page,
          pageSize: query.pageSize,
          sortBy: query.sortBy,
          sortDirection: query.sortDirection,
          ...(query.status ? { status: query.status } : {}),
          ...(query.categoryId ? { categoryId: query.categoryId } : {}),
          ...(query.search ? { search: query.search } : {}),
        },
      );
      const page = pageResult(result.items, result.total, query);
      return apiSuccess(page.data, { meta: page.meta });
    } catch (error) {
      return translateDishError(error);
    }
  });
}
