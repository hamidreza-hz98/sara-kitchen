import type { NextRequest } from "next/server";

import { pageResult } from "@/server/database";
import { apiSuccess, handleApiRoute, parseQueryParameters } from "@/server/http";
import { contactListQuerySchema } from "@/server/modules/contacts";

import {
  contactAdminRequestContext,
  resolveContactFlow,
  translateContactFlowError,
} from "./route-helper";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await contactAdminRequestContext(
      request,
      "contacts:read",
    );
    const query = parseQueryParameters(request, contactListQuerySchema, validation);
    try {
      const result = await resolveContactFlow(
        connection,
        requestId,
        request.headers.get("user-agent"),
      ).list(
        { id: actor.id, role: actor.role },
        {
          page: query.page,
          pageSize: query.pageSize,
          ...(query.search ? { search: query.search } : {}),
          ...(query.status ? { status: query.status } : {}),
          ...(query.assigneeAdminId ? { assigneeAdminId: query.assigneeAdminId } : {}),
          sortDirection: query.sortDirection,
        },
      );
      const page = pageResult(result.items, result.total, {
        page: query.page,
        pageSize: query.pageSize,
        sortBy: "createdAt",
        sortDirection: query.sortDirection,
      });
      return apiSuccess(page.data, { meta: page.meta });
    } catch (error) {
      return translateContactFlowError(error);
    }
  });
}
