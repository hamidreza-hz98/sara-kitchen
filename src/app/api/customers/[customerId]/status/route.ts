import type { NextRequest } from "next/server";

import { apiSuccess, handleApiRoute, parseJsonRequest, parseRouteParameters } from "@/server/http";
import { customerIdParametersSchema, customerStatusSchema } from "@/server/modules/customers";

import {
  customerAdminRequestContext,
  resolveCustomerCrudServices,
  translateCustomerCrudError,
} from "../../route-helper";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ customerId: string }> };

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await customerAdminRequestContext(
      request,
      "customers:update",
      true,
    );
    const [{ customerId }, input] = await Promise.all([
      parseRouteParameters(context.params, customerIdParametersSchema, validation),
      parseJsonRequest(request, customerStatusSchema, validation),
    ]);
    try {
      return apiSuccess(
        await resolveCustomerCrudServices(
          connection,
          requestId,
          request.headers.get("user-agent"),
        ).setStatus({ kind: "admin", id: actor.id, role: actor.role }, customerId, input.status),
      );
    } catch (error) {
      return translateCustomerCrudError(error);
    }
  });
}
