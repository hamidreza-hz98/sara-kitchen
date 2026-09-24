import type { NextRequest } from "next/server";

import { pageResult } from "@/server/database";
import { apiSuccess, handleApiRoute, parseJsonRequest, parseQueryParameters } from "@/server/http";
import {
  blogCreateSchema,
  blogPublicListQuerySchema,
  type BlogInput,
} from "@/server/modules/blogs";

import {
  BLOG_PUBLIC_CACHE_CONTROL,
  blogAdminRequestContext,
  blogPublicRequestContext,
  resolveBlogServices,
  translateBlogError,
} from "./route-helper";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, locale, validation } = await blogPublicRequestContext(request, "list");
    const query = parseQueryParameters(request, blogPublicListQuerySchema, validation);
    try {
      const result = await resolveBlogServices(connection, requestId).listPublic({
        page: query.page,
        pageSize: query.pageSize,
        sortBy: query.sortBy,
        sortDirection: query.sortDirection,
        locale: query.locale ?? locale,
        ...(query.search ? { search: query.search } : {}),
      });
      const page = pageResult(result.items, result.total, query);
      return apiSuccess(page.data, {
        meta: page.meta,
        headers: { "cache-control": BLOG_PUBLIC_CACHE_CONTROL, vary: "Cookie" },
      });
    } catch (error) {
      return translateBlogError(error);
    }
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await blogAdminRequestContext(
      request,
      "blogs:create",
      true,
    );
    const input = await parseJsonRequest(request, blogCreateSchema, validation);
    try {
      return apiSuccess(
        await resolveBlogServices(connection, requestId).create(
          { id: actor.id, displayName: actor.displayName, role: actor.role },
          input as BlogInput,
        ),
        { status: 201 },
      );
    } catch (error) {
      return translateBlogError(error);
    }
  });
}
