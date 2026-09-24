import type { NextRequest } from "next/server";

import { apiSuccess, handleApiRoute, parseJsonRequest, parseRouteParameters } from "@/server/http";
import {
  staticSeoKeyParametersSchema,
  staticSeoUpdateSchema,
  type StaticSeoUpdateInput,
} from "@/server/modules/seo";

import {
  resolveStaticSeoServices,
  staticSeoRequestContext,
  translateStaticSeoError,
} from "../route-helper";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ staticPageKey: string }> };

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await staticSeoRequestContext(request, "seo:read");
    const { staticPageKey } = await parseRouteParameters(
      context.params,
      staticSeoKeyParametersSchema,
      validation,
    );
    try {
      return apiSuccess(
        await resolveStaticSeoServices(connection, requestId).get(
          { id: actor.id, role: actor.role },
          staticPageKey,
        ),
      );
    } catch (error) {
      return translateStaticSeoError(error);
    }
  });
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await staticSeoRequestContext(
      request,
      "seo:update",
      true,
    );
    const [{ staticPageKey }, input] = await Promise.all([
      parseRouteParameters(context.params, staticSeoKeyParametersSchema, validation),
      parseJsonRequest(request, staticSeoUpdateSchema, validation),
    ]);
    try {
      return apiSuccess(
        await resolveStaticSeoServices(connection, requestId).update(
          { id: actor.id, role: actor.role },
          staticPageKey,
          input as StaticSeoUpdateInput,
        ),
      );
    } catch (error) {
      return translateStaticSeoError(error);
    }
  });
}
