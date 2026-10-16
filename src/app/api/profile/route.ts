import type { NextRequest } from "next/server";
import { z } from "zod";

import { apiSuccess, handleApiRoute, parseJsonRequest } from "@/server/http";
import { clearCustomerCookie } from "@/server/modules/auth";
import { customerProfileUpdateSchema } from "@/server/modules/customers";

import {
  customerSelfRequestContext,
  resolveCustomerCrudServices,
  translateCustomerCrudError,
} from "../customers/route-helper";
import { confirmCustomerPrivacyPassword } from "./privacy-confirmation";

export const runtime = "nodejs";
const deletionConfirmationSchema = z.strictObject({ currentPassword: z.string().min(1).max(1024) });

export async function GET(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor } = await customerSelfRequestContext(request);
    try {
      return apiSuccess(
        await resolveCustomerCrudServices(connection, requestId).get(
          { kind: "customer", id: actor.id },
          actor.id,
        ),
      );
    } catch (error) {
      return translateCustomerCrudError(error);
    }
  });
}

export async function PATCH(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await customerSelfRequestContext(request, true);
    const input = await parseJsonRequest(request, customerProfileUpdateSchema, validation);
    try {
      return apiSuccess(
        await resolveCustomerCrudServices(
          connection,
          requestId,
          request.headers.get("user-agent"),
        ).update({ kind: "customer", id: actor.id }, actor.id, input),
      );
    } catch (error) {
      return translateCustomerCrudError(error);
    }
  });
}

export async function DELETE(request: NextRequest): Promise<Response> {
  const response = await handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await customerSelfRequestContext(request, true);
    const { currentPassword } = await parseJsonRequest(
      request,
      deletionConfirmationSchema,
      validation,
    );
    await confirmCustomerPrivacyPassword(connection, request, actor.id, currentPassword);
    try {
      return apiSuccess(
        await resolveCustomerCrudServices(
          connection,
          requestId,
          request.headers.get("user-agent"),
        ).anonymize({ kind: "customer", id: actor.id }, actor.id),
      );
    } catch (error) {
      return translateCustomerCrudError(error);
    }
  });
  if (response.ok) response.headers.append("set-cookie", clearCustomerCookie());
  return response;
}
