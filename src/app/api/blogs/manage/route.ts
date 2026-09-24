import type { NextRequest } from "next/server";

import { pageResult } from "@/server/database";
import { apiSuccess, handleApiRoute, parseQueryParameters } from "@/server/http";
import { blogManagementListQuerySchema } from "@/server/modules/blogs";

import { blogAdminRequestContext, resolveBlogServices, translateBlogError } from "../route-helper";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await blogAdminRequestContext(request, "blogs:read");
    const query = parseQueryParameters(request, blogManagementListQuerySchema, validation);
    try {
      const result = await resolveBlogServices(connection, requestId).list(
        { id: actor.id, displayName: actor.displayName, role: actor.role },
        {
          page: query.page,
          pageSize: query.pageSize,
          sortBy: query.sortBy,
          sortDirection: query.sortDirection,
          ...(query.status ? { status: query.status } : {}),
          ...(query.authorAdminId ? { authorAdminId: query.authorAdminId } : {}),
          ...(query.search ? { search: query.search } : {}),
        },
      );
      const page = pageResult(result.items, result.total, query);
      return apiSuccess(page.data, {
        meta: page.meta,
        headers: { "cache-control": "private, no-store" },
      });
    } catch (error) {
      return translateBlogError(error);
    }
  });
}
