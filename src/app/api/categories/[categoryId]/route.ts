import type { NextRequest } from "next/server";

import {
  ApiError,
  apiSuccess,
  handleApiRoute,
  parseJsonRequest,
  parseRouteParameters,
} from "@/server/http";
import {
  categoryIdParametersSchema,
  categoryUpdateSchema,
  createCategoryAuditSink,
  createCategoryRepository,
  type CategoryUpdate,
} from "@/server/modules/categories";

import {
  categoryMutationUnavailable,
  categoryRequestContext,
  resolveCategoryMutationServices,
  translateCategoryServiceError,
} from "../route-helper";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ categoryId: string }> };

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await categoryRequestContext(
      request,
      "categories:read",
    );
    const { categoryId } = await parseRouteParameters(
      context.params,
      categoryIdParametersSchema,
      validation,
    );
    const item = await createCategoryRepository(connection).findById(categoryId);
    if (!item) throw ApiError.notFound("category");
    await createCategoryAuditSink(connection, { requestId })({
      action: "read",
      actorId: actor.id,
      categoryId: item.id,
      outcome: "success",
    });
    return apiSuccess(item);
  });
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await categoryRequestContext(
      request,
      "categories:update",
      true,
    );
    const [{ categoryId }, update] = await Promise.all([
      parseRouteParameters(context.params, categoryIdParametersSchema, validation),
      parseJsonRequest(request, categoryUpdateSchema, validation),
    ]);
    const services = resolveCategoryMutationServices(connection, requestId);
    if (!services) categoryMutationUnavailable();
    try {
      return apiSuccess(
        await services.update(
          { id: actor.id, role: actor.role },
          categoryId,
          update as CategoryUpdate,
        ),
      );
    } catch (error) {
      return translateCategoryServiceError(error);
    }
  });
}
