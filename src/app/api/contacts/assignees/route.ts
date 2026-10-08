import type { NextRequest } from "next/server";

import { pageResult } from "@/server/database";
import { apiSuccess, handleApiRoute, parseQueryParameters } from "@/server/http";
import { adminListQuerySchema, createAdminRepository } from "@/server/modules/admins";

import { contactAdminRequestContext } from "../route-helper";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, async () => {
    const { connection, validation } = await contactAdminRequestContext(request, "contacts:update");
    const query = parseQueryParameters(request, adminListQuerySchema, validation);
    const result = await createAdminRepository(connection).list({
      page: query.page,
      pageSize: query.pageSize,
      ...(query.search ? { search: query.search } : {}),
      status: "active",
      sortBy: "firstName",
      sortDirection: "asc",
    });
    const items = result.items.map((admin) => ({
      id: admin.id,
      displayName: `${admin.firstName} ${admin.lastName}`,
      role: admin.role,
    }));
    const page = pageResult(items, result.total, {
      page: query.page,
      pageSize: query.pageSize,
      sortBy: "firstName",
      sortDirection: "asc",
    });
    return apiSuccess(page.data, { meta: page.meta });
  });
}
