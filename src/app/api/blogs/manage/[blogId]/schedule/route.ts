import type { NextRequest } from "next/server";

import { apiSuccess, handleApiRoute, parseJsonRequest, parseRouteParameters } from "@/server/http";
import { blogIdParametersSchema, blogScheduleSchema } from "@/server/modules/blogs";

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
    const [{ blogId }, input] = await Promise.all([
      parseRouteParameters(context.params, blogIdParametersSchema, state.validation),
      parseJsonRequest(request, blogScheduleSchema, state.validation),
    ]);
    try {
      return apiSuccess(
        await resolveBlogServices(state.connection, requestId).schedule(
          { id: state.actor.id, displayName: state.actor.displayName, role: state.actor.role },
          blogId,
          input.publishAt,
        ),
      );
    } catch (error) {
      return translateBlogError(error);
    }
  });
}
