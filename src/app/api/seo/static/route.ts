import type { NextRequest } from "next/server";

import { apiSuccess, handleApiRoute, parseJsonRequest } from "@/server/http";
import { staticSeoCreateSchema, type StaticSeoCreateInput } from "@/server/modules/seo";

import {
  resolveStaticSeoServices,
  staticSeoRequestContext,
  translateStaticSeoError,
} from "./route-helper";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor } = await staticSeoRequestContext(request, "seo:read");
    try {
      return apiSuccess(
        await resolveStaticSeoServices(connection, requestId).list({
          id: actor.id,
          role: actor.role,
        }),
      );
    } catch (error) {
      return translateStaticSeoError(error);
    }
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await staticSeoRequestContext(
      request,
      "seo:create",
      true,
    );
    const input = await parseJsonRequest(request, staticSeoCreateSchema, validation);
    try {
      const created = await resolveStaticSeoServices(connection, requestId).create(
        { id: actor.id, role: actor.role },
        input as StaticSeoCreateInput,
      );
      return apiSuccess(created, { status: 201 });
    } catch (error) {
      return translateStaticSeoError(error);
    }
  });
}
