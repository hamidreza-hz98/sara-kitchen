import type { NextRequest } from "next/server";

import { pageResult } from "@/server/database";
import { apiSuccess, handleApiRoute, parseJsonRequest, parseQueryParameters } from "@/server/http";
import {
  adminCreateSchema,
  adminListQuerySchema,
  type AdminCreateInput,
} from "@/server/modules/admins";

import {
  adminRequestContext,
  resolveAdminCrudServices,
  translateAdminCrudError,
} from "./route-helper";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await adminRequestContext(request, "admins:read");
    const query = parseQueryParameters(request, adminListQuerySchema, validation);
    try {
      const result = await resolveAdminCrudServices(
        connection,
        requestId,
        request.headers.get("user-agent"),
      ).list(
        { id: actor.id, role: actor.role },
        {
          page: query.page,
          pageSize: query.pageSize,
          ...(query.search ? { search: query.search } : {}),
          ...(query.role ? { role: query.role } : {}),
          ...(query.status ? { status: query.status } : {}),
          sortBy: query.sortBy,
          sortDirection: query.sortDirection,
        },
      );
      const page = pageResult(result.items, result.total, {
        page: query.page,
        pageSize: query.pageSize,
        sortBy: query.sortBy,
        sortDirection: query.sortDirection,
      });
      return apiSuccess(page.data, { meta: page.meta });
    } catch (error) {
      return translateAdminCrudError(error);
    }
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await adminRequestContext(
      request,
      "admins:create",
      true,
    );
    const input = await parseJsonRequest(request, adminCreateSchema, validation);
    try {
      return apiSuccess(
        await resolveAdminCrudServices(
          connection,
          requestId,
          request.headers.get("user-agent"),
        ).create({ id: actor.id, role: actor.role }, input as AdminCreateInput),
        { status: 201 },
      );
    } catch (error) {
      return translateAdminCrudError(error);
    }
  });
}
