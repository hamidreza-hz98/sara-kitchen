import type { NextRequest } from "next/server";

import {
  apiSuccess,
  handleApiRoute,
  parseQueryParameters,
  parseRouteParameters,
} from "@/server/http";
import { blogPreviewQuerySchema, blogSlugParametersSchema } from "@/server/modules/blogs";

import {
  blogPublicRequestContext,
  optionalBlogPreviewActor,
  resolveBlogServices,
  translateBlogError,
} from "../../route-helper";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ blogSlug: string }> };

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, validation } = await blogPublicRequestContext(request, "preview");
    const [{ blogSlug }, query] = await Promise.all([
      parseRouteParameters(context.params, blogSlugParametersSchema, validation),
      parseQueryParameters(request, blogPreviewQuerySchema, validation),
    ]);
    try {
      const actor = query.token ? null : await optionalBlogPreviewActor(connection, request);
      const value = await resolveBlogServices(connection, requestId).previewBySlug(
        blogSlug,
        query.token ?? null,
        actor ? { id: actor.id, displayName: actor.displayName, role: actor.role } : undefined,
      );
      return apiSuccess(value, {
        headers: { "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow" },
      });
    } catch (error) {
      return translateBlogError(error);
    }
  });
}
