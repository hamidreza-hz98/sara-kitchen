import type { NextRequest } from "next/server";

import { apiSuccess, handleApiRoute, parseJsonRequest, parseRouteParameters } from "@/server/http";
import {
  addressEmptyMutationSchema,
  addressIdParametersSchema,
  addressUpdateSchema,
} from "@/server/modules/addresses";

import {
  addressSelfRequestContext,
  resolveAddressCrudServices,
  translateAddressCrudError,
} from "../../../addresses/route-helper";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ addressId: string }> };

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await addressSelfRequestContext(request);
    const { addressId } = await parseRouteParameters(
      context.params,
      addressIdParametersSchema,
      validation,
    );
    try {
      return apiSuccess(
        await resolveAddressCrudServices(connection, requestId).get(
          { kind: "customer", id: actor.id },
          actor.id,
          addressId,
        ),
      );
    } catch (error) {
      return translateAddressCrudError(error);
    }
  });
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await addressSelfRequestContext(request, true);
    const [{ addressId }, input] = await Promise.all([
      parseRouteParameters(context.params, addressIdParametersSchema, validation),
      parseJsonRequest(request, addressUpdateSchema, validation),
    ]);
    try {
      return apiSuccess(
        await resolveAddressCrudServices(
          connection,
          requestId,
          request.headers.get("user-agent"),
        ).update({ kind: "customer", id: actor.id }, actor.id, addressId, input),
      );
    } catch (error) {
      return translateAddressCrudError(error);
    }
  });
}

export async function DELETE(request: NextRequest, context: RouteContext): Promise<Response> {
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
        ).remove({ kind: "customer", id: actor.id }, actor.id, addressId),
      );
    } catch (error) {
      return translateAddressCrudError(error);
    }
  });
}
