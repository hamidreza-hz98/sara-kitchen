import type { NextRequest } from "next/server";
import { apiSuccess, handleApiRoute, parseJsonRequest, parseRouteParameters } from "@/server/http";
import { blogEmptyMutationSchema, blogIdParametersSchema } from "@/server/modules/blogs";
import {
  blogAdminRequestContext,
  resolveBlogServices,
  translateBlogError,
} from "../../../route-helper";
export const runtime = "nodejs";
type RouteContext = { params: Promise<{ blogId: string }> };
export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const state = await blogAdminRequestContext(request, "blogs:publish", true);
    const [{ blogId }] = await Promise.all([
      parseRouteParameters(context.params, blogIdParametersSchema, state.validation),
      parseJsonRequest(request, blogEmptyMutationSchema, state.validation),
    ]);
    try {
      return apiSuccess(
        await resolveBlogServices(state.connection, requestId).unpublish(
          { id: state.actor.id, displayName: state.actor.displayName, role: state.actor.role },
          blogId,
        ),
      );
    } catch (error) {
      return translateBlogError(error);
    }
  });
}
