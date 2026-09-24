import type { NextRequest } from "next/server";

import { apiSuccess, handleApiRoute, parseJsonRequest, parseRouteParameters } from "@/server/http";
import { blogIdParametersSchema, blogUpdateSchema, type BlogUpdate } from "@/server/modules/blogs";

import {
  blogAdminRequestContext,
  resolveBlogServices,
  translateBlogError,
} from "../../route-helper";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ blogId: string }> };
const actor = (value: Awaited<ReturnType<typeof blogAdminRequestContext>>["actor"]) => ({
  id: value.id,
  displayName: value.displayName,
  role: value.role,
});

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const state = await blogAdminRequestContext(request, "blogs:read");
    const { blogId } = await parseRouteParameters(
      context.params,
      blogIdParametersSchema,
      state.validation,
    );
    try {
      return apiSuccess(
        await resolveBlogServices(state.connection, requestId).get(actor(state.actor), blogId),
      );
    } catch (error) {
      return translateBlogError(error);
    }
  });
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const state = await blogAdminRequestContext(request, "blogs:update", true);
    const [{ blogId }, input] = await Promise.all([
      parseRouteParameters(context.params, blogIdParametersSchema, state.validation),
      parseJsonRequest(request, blogUpdateSchema, state.validation),
    ]);
    try {
      return apiSuccess(
        await resolveBlogServices(state.connection, requestId).update(
          actor(state.actor),
          blogId,
          input as BlogUpdate,
        ),
      );
    } catch (error) {
      return translateBlogError(error);
    }
  });
}
