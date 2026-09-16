import type { NextRequest } from "next/server";
import { z } from "zod";

import { LOCALE_COOKIE_NAME, resolveLocalePreference } from "@/locales/routing";
import {
  AdminLoginRejectedError,
  adminCookieName,
  isSameOriginMutation,
  loginAdmin,
  serializeAdminCookie,
} from "@/server/modules/auth";
import { connectToDatabase } from "@/server/database";
import {
  ApiError,
  apiSuccess,
  getRequestValidationOptions,
  handleApiRoute,
  parseJsonRequest,
} from "@/server/http";

export const runtime = "nodejs";
const loginSchema = z.strictObject({
  identifier: z.string().min(1).max(254),
  password: z.string().min(1).max(1024),
});

export async function POST(request: NextRequest): Promise<Response> {
  let cookie: string | undefined;
  const response = await handleApiRoute(request, async () => {
    if (!isSameOriginMutation(request)) throw ApiError.authorization();
    const locale = resolveLocalePreference(request.cookies.get(LOCALE_COOKIE_NAME)?.value);
    const input = await parseJsonRequest(
      request,
      loginSchema,
      await getRequestValidationOptions(locale),
    );
    const connection = await connectToDatabase();
    try {
      const result = await loginAdmin(connection, {
        ...input,
        priorToken: request.cookies.get(adminCookieName())?.value ?? null,
        userAgent: request.headers.get("user-agent"),
      });
      cookie = serializeAdminCookie(result.session.token, result.session.expiresAt);
      return apiSuccess({ authenticated: true as const });
    } catch (error) {
      if (error instanceof AdminLoginRejectedError)
        throw ApiError.authentication("Invalid credentials.");
      throw error;
    }
  });
  if (cookie && response.ok) response.headers.append("set-cookie", cookie);
  return response;
}
