import type { NextRequest } from "next/server";

import { apiSuccess, handleApiRoute, parseJsonRequest, parseRouteParameters } from "@/server/http";
import { categoryArchiveSchema, categoryIdParametersSchema } from "@/server/modules/categories";

import {
  categoryMutationUnavailable,
  categoryRequestContext,
  resolveCategoryMutationServices,
  translateCategoryServiceError,
} from "../../route-helper";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ categoryId: string }> };

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await categoryRequestContext(
      request,
      "categories:update",
      true,
    );
    const [{ categoryId }] = await Promise.all([
      parseRouteParameters(context.params, categoryIdParametersSchema, validation),
      parseJsonRequest(request, categoryArchiveSchema, validation),
    ]);
    const services = resolveCategoryMutationServices(connection, requestId);
    if (!services) categoryMutationUnavailable();
    try {
      return apiSuccess(await services.archive({ id: actor.id, role: actor.role }, categoryId));
    } catch (error) {
      return translateCategoryServiceError(error);
    }
  });
}
