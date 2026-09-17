import type { NextRequest } from "next/server";

import { connectToDatabase } from "@/server/database";
import { ApiError, apiSuccess, handleApiRoute } from "@/server/http";
import {
  adminCookieName,
  AuthorizationGuardError,
  createCsrfToken,
  customerCookieName,
  requireAdminActor,
  requireCustomerActor,
} from "@/server/modules/auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, async () => {
    const principal = request.nextUrl.searchParams.get("principal");
    if (principal !== "admin" && principal !== "customer") throw ApiError.validation([]);
    const token = request.cookies.get(
      principal === "admin" ? adminCookieName() : customerCookieName(),
    )?.value;
    try {
      const connection = await connectToDatabase();
      if (principal === "admin") await requireAdminActor(connection, token);
      else await requireCustomerActor(connection, token);
    } catch (error) {
      if (error instanceof AuthorizationGuardError) throw ApiError.authentication();
      throw error;
    }
    return apiSuccess({ csrfToken: createCsrfToken(principal, token!) });
  });
}
