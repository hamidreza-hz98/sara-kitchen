import type { NextRequest } from "next/server";

import { apiSuccess, handleApiRoute, parseJsonRequest } from "@/server/http";
import { addressWriteSchema } from "@/server/modules/addresses";

import {
  addressSelfRequestContext,
  resolveAddressCrudServices,
  translateAddressCrudError,
} from "../../addresses/route-helper";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor } = await addressSelfRequestContext(request);
    try {
      return apiSuccess(
        await resolveAddressCrudServices(connection, requestId).list(
          { kind: "customer", id: actor.id },
          actor.id,
        ),
      );
    } catch (error) {
      return translateAddressCrudError(error);
    }
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await addressSelfRequestContext(request, true);
    const input = await parseJsonRequest(request, addressWriteSchema, validation);
    try {
      return apiSuccess(
        await resolveAddressCrudServices(
          connection,
          requestId,
          request.headers.get("user-agent"),
        ).create({ kind: "customer", id: actor.id }, actor.id, input),
        { status: 201 },
      );
    } catch (error) {
      return translateAddressCrudError(error);
    }
  });
}
