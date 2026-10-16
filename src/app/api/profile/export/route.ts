import type { NextRequest } from "next/server";
import { z } from "zod";

import { apiSuccess, handleApiRoute, parseJsonRequest } from "@/server/http";

import {
  customerSelfRequestContext,
  resolveCustomerCrudServices,
  translateCustomerCrudError,
} from "../../customers/route-helper";
import { confirmCustomerPrivacyPassword } from "../privacy-confirmation";

export const runtime = "nodejs";
const confirmationSchema = z.strictObject({ currentPassword: z.string().min(1).max(1024) });

export async function POST(request: NextRequest): Promise<Response> {
  const response = await handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await customerSelfRequestContext(request, true);
    const { currentPassword } = await parseJsonRequest(request, confirmationSchema, validation);
    await confirmCustomerPrivacyPassword(connection, request, actor.id, currentPassword);
    try {
      return apiSuccess(
        await resolveCustomerCrudServices(
          connection,
          requestId,
          request.headers.get("user-agent"),
        ).exportAccount({ kind: "customer", id: actor.id }, actor.id),
        { headers: { "Cache-Control": "private, no-store" } },
      );
    } catch (error) {
      return translateCustomerCrudError(error);
    }
  });
  if (response.ok)
    response.headers.set("content-disposition", "attachment; filename=customer-data.json");
  return response;
}
