import type { NextRequest } from "next/server";

import { apiSuccess, handleApiRoute, parseJsonRequest, parseRouteParameters } from "@/server/http";
import {
  customerEmptyMutationSchema,
  customerIdParametersSchema,
  customerProfileUpdateSchema,
} from "@/server/modules/customers";

import {
  customerAdminRequestContext,
  customerOrderSummaries,
  resolveCustomerCrudServices,
  translateCustomerCrudError,
} from "../route-helper";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ customerId: string }> };

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await customerAdminRequestContext(
      request,
      "customers:read",
    );
    const { customerId } = await parseRouteParameters(
      context.params,
      customerIdParametersSchema,
      validation,
    );
    try {
      const customer = await resolveCustomerCrudServices(connection, requestId).get(
        { kind: "admin", id: actor.id, role: actor.role },
        customerId,
      );
      const summaries = await customerOrderSummaries(connection, [customerId]);
      return apiSuccess({
        ...customer,
        summary: summaries[customerId] ?? {
          orderCount: 0,
          totalSpentCents: 0,
          lastOrderAt: null,
        },
      });
    } catch (error) {
      return translateCustomerCrudError(error);
    }
  });
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await customerAdminRequestContext(
      request,
      "customers:update",
      true,
    );
    const [{ customerId }, input] = await Promise.all([
      parseRouteParameters(context.params, customerIdParametersSchema, validation),
      parseJsonRequest(request, customerProfileUpdateSchema, validation),
    ]);
    try {
      return apiSuccess(
        await resolveCustomerCrudServices(
          connection,
          requestId,
          request.headers.get("user-agent"),
        ).update({ kind: "admin", id: actor.id, role: actor.role }, customerId, input),
      );
    } catch (error) {
      return translateCustomerCrudError(error);
    }
  });
}

export async function DELETE(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await customerAdminRequestContext(
      request,
      "customers:delete",
      true,
    );
    const [{ customerId }] = await Promise.all([
      parseRouteParameters(context.params, customerIdParametersSchema, validation),
      parseJsonRequest(request, customerEmptyMutationSchema, validation),
    ]);
    try {
      return apiSuccess(
        await resolveCustomerCrudServices(
          connection,
          requestId,
          request.headers.get("user-agent"),
        ).anonymize({ kind: "admin", id: actor.id, role: actor.role }, customerId),
      );
    } catch (error) {
      return translateCustomerCrudError(error);
    }
  });
}
