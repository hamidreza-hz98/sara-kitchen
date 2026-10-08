import type { NextRequest } from "next/server";

import { LOCALE_COOKIE_NAME, resolveLocalePreference } from "@/locales/routing";
import { connectToDatabase } from "@/server/database";
import {
  ApiError,
  apiSuccess,
  getRequestValidationOptions,
  handleApiRoute,
  parseQueryParameters,
} from "@/server/http";
import { AuthorizationGuardError, adminCookieName, requireAdminActor } from "@/server/modules/auth";
import { auditLogReadQuerySchema, readAuditLogs } from "@/server/modules/logs";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const token = request.cookies.get(adminCookieName())?.value;
    if (!token) throw ApiError.authentication();
    const connection = await connectToDatabase();
    let actor;
    try {
      actor = await requireAdminActor(connection, token, "logs:read");
    } catch (error) {
      if (error instanceof AuthorizationGuardError) {
        throw error.reason === "unauthenticated"
          ? ApiError.authentication()
          : ApiError.authorization();
      }
      throw error;
    }
    const locale = resolveLocalePreference(request.cookies.get(LOCALE_COOKIE_NAME)?.value);
    const query = parseQueryParameters(
      request,
      auditLogReadQuerySchema,
      await getRequestValidationOptions(locale),
    );
    const result = await readAuditLogs(
      connection,
      {
        active: true,
        displayName: actor.displayName,
        id: actor.id,
        kind: "admin",
        permissions: actor.permissions,
        role: actor.role,
      },
      {
        network: { policy: "omitted", ipAddress: null, ipHash: null },
        requestId,
        userAgent: request.headers.get("user-agent"),
      },
      query,
    );
    return apiSuccess(result.data, { meta: result.meta });
  });
}
