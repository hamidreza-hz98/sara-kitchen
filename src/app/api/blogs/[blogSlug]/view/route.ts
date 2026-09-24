import type { NextRequest } from "next/server";

import { apiSuccess, handleApiRoute, parseJsonRequest, parseRouteParameters } from "@/server/http";
import { blogSlugParametersSchema, blogViewSchema } from "@/server/modules/blogs";

import {
  blogPublicRequestContext,
  queueBlogView,
  resolveBlogServices,
  translateBlogError,
} from "../../route-helper";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ blogSlug: string }> };

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, validation } = await blogPublicRequestContext(request, "view");
    const [{ blogSlug }, input] = await Promise.all([
      parseRouteParameters(context.params, blogSlugParametersSchema, validation),
      parseJsonRequest(request, blogViewSchema.omit({ blogId: true }), validation),
    ]);
    try {
      const blog = await resolveBlogServices(connection, requestId).getPublicBySlug(blogSlug);
      const status = queueBlogView(connection, requestId, {
        blogId: blog.id,
        engagementMs: input.engagementMs,
        visibilityState: input.visibilityState,
        userAgent: request.headers.get("user-agent"),
        clientAddress: request.headers.get("x-forwarded-for"),
        purpose: request.headers.get("purpose") ?? request.headers.get("sec-purpose"),
      });
      return apiSuccess({ accepted: status === "scheduled" }, { status: 202 });
    } catch (error) {
      return translateBlogError(error);
    }
  });
}
