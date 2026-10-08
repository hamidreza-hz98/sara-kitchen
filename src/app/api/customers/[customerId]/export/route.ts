import type { NextRequest } from "next/server";

import { apiSuccess, handleApiRoute, parseRouteParameters } from "@/server/http";
import { customerIdParametersSchema } from "@/server/modules/customers";

import {
  customerAdminRequestContext,
  resolveCustomerCrudServices,
  translateCustomerCrudError,
} from "../../route-helper";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ customerId: string }> };

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  const response = await handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await customerAdminRequestContext(
      request,
      "customers:read-sensitive",
    );
    const { customerId } = await parseRouteParameters(
      context.params,
      customerIdParametersSchema,
      validation,
    );
    try {
      return apiSuccess(
        await resolveCustomerCrudServices(
          connection,
          requestId,
          request.headers.get("user-agent"),
        ).exportAccount({ kind: "admin", id: actor.id, role: actor.role }, customerId),
      );
    } catch (error) {
      return translateCustomerCrudError(error);
    }
  });
  if (response.ok)
    response.headers.set("content-disposition", "attachment; filename=customer-data.json");
  return response;
}
