import type { NextRequest } from "next/server";

import { apiSuccess, handleApiRoute } from "@/server/http";

import {
  customerSelfRequestContext,
  resolveCustomerCrudServices,
  translateCustomerCrudError,
} from "../../customers/route-helper";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  const response = await handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor } = await customerSelfRequestContext(request);
    try {
      return apiSuccess(
        await resolveCustomerCrudServices(
          connection,
          requestId,
          request.headers.get("user-agent"),
        ).exportAccount({ kind: "customer", id: actor.id }, actor.id),
      );
    } catch (error) {
      return translateCustomerCrudError(error);
    }
  });
  if (response.ok)
    response.headers.set("content-disposition", "attachment; filename=customer-data.json");
  return response;
}
