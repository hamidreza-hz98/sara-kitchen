import type { NextRequest } from "next/server";

import { apiSuccess, handleApiRoute, parseRouteParameters } from "@/server/http";
import { customerAddressParametersSchema } from "@/server/modules/addresses";

import {
  addressAdminRequestContext,
  resolveAddressCrudServices,
  translateAddressCrudError,
} from "../../../../addresses/route-helper";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ customerId: string; addressId: string }> };

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await addressAdminRequestContext(request);
    const { customerId, addressId } = await parseRouteParameters(
      context.params,
      customerAddressParametersSchema,
      validation,
    );
    if (!addressId) throw new Error("Validated addressId is unexpectedly missing.");
    try {
      return apiSuccess(
        await resolveAddressCrudServices(connection, requestId).get(
          { kind: "admin", id: actor.id, role: actor.role },
          customerId,
          addressId,
        ),
      );
    } catch (error) {
      return translateAddressCrudError(error);
    }
  });
}
