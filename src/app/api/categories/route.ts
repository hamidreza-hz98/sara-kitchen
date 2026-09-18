import type { NextRequest } from "next/server";

import { pageResult } from "@/server/database";
import { apiSuccess, handleApiRoute, parseJsonRequest, parseQueryParameters } from "@/server/http";
import {
  categoryCreateSchema,
  categoryListQuerySchema,
  createCategoryAuditSink,
  createCategoryRepository,
  type CategoryInput,
} from "@/server/modules/categories";

import {
  categoryMutationUnavailable,
  categoryRequestContext,
  resolveCategoryMutationServices,
  translateCategoryServiceError,
} from "./route-helper";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await categoryRequestContext(
      request,
      "categories:read",
    );
    const query = parseQueryParameters(request, categoryListQuerySchema, validation);
    const result = await createCategoryRepository(connection).list({
      page: query.page,
      pageSize: query.pageSize,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search ? { search: query.search } : {}),
      sortBy: query.sortBy,
      sortDirection: query.sortDirection,
    });
    const page = pageResult(result.items, result.total, {
      page: query.page,
      pageSize: query.pageSize,
      sortBy: query.sortBy,
      sortDirection: query.sortDirection,
    });
    await createCategoryAuditSink(connection, { requestId })({
      action: "read",
      actorId: actor.id,
      categoryId: null,
      outcome: "success",
    });
    return apiSuccess(page.data, { meta: page.meta });
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await categoryRequestContext(
      request,
      "categories:create",
      true,
    );
    const input = await parseJsonRequest(request, categoryCreateSchema, validation);
    const services = resolveCategoryMutationServices(connection, requestId);
    if (!services) categoryMutationUnavailable();
    try {
      const created = await services.create(
        { id: actor.id, role: actor.role },
        input as CategoryInput,
      );
      return apiSuccess(created, { status: 201 });
    } catch (error) {
      return translateCategoryServiceError(error);
    }
  });
}
