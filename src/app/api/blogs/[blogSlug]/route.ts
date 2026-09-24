import type { NextRequest } from "next/server";

import {
  apiSuccess,
  handleApiRoute,
  parseQueryParameters,
  parseRouteParameters,
} from "@/server/http";
import { blogDetailQuerySchema, blogSlugParametersSchema } from "@/server/modules/blogs";

import {
  BLOG_PUBLIC_CACHE_CONTROL,
  blogPublicRequestContext,
  resolveBlogServices,
  translateBlogError,
} from "../route-helper";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ blogSlug: string }> };

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, locale, validation } = await blogPublicRequestContext(request, "detail");
    const [{ blogSlug }, query] = await Promise.all([
      parseRouteParameters(context.params, blogSlugParametersSchema, validation),
      parseQueryParameters(request, blogDetailQuerySchema, validation),
    ]);
    try {
      return apiSuccess(
        await resolveBlogServices(connection, requestId).getPublicBySlug(
          blogSlug,
          query.locale ?? locale,
        ),
        { headers: { "cache-control": BLOG_PUBLIC_CACHE_CONTROL, vary: "Cookie" } },
      );
    } catch (error) {
      return translateBlogError(error);
    }
  });
}
