import type { NextRequest } from "next/server";

import { apiSuccess, handleApiRoute, parseJsonRequest, parseRouteParameters } from "@/server/http";
import { addressEmptyMutationSchema, addressIdParametersSchema } from "@/server/modules/addresses";

import {
  addressSelfRequestContext,
  resolveAddressCrudServices,
  translateAddressCrudError,
} from "../../../../addresses/route-helper";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ addressId: string }> };

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await addressSelfRequestContext(request, true);
    const [{ addressId }] = await Promise.all([
      parseRouteParameters(context.params, addressIdParametersSchema, validation),
      parseJsonRequest(request, addressEmptyMutationSchema, validation),
    ]);
    try {
      return apiSuccess(
        await resolveAddressCrudServices(
          connection,
          requestId,
          request.headers.get("user-agent"),
        ).setDefault({ kind: "customer", id: actor.id }, actor.id, addressId),
      );
    } catch (error) {
      return translateAddressCrudError(error);
    }
  });
}
