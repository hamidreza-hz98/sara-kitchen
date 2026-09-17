import type { NextRequest } from "next/server";
import { z } from "zod";

import { LOCALE_COOKIE_NAME, resolveLocalePreference } from "@/locales/routing";
import { connectToDatabase } from "@/server/database";
import {
  ApiError,
  apiSuccess,
  getRequestValidationOptions,
  handleApiRoute,
  parseJsonRequest,
} from "@/server/http";
import {
  adminCookieName,
  clearAdminCookie,
  isProtectedMutation,
  logoutAdmin,
} from "@/server/modules/auth";

export const runtime = "nodejs";
const emptyBodySchema = z.strictObject({});

export async function POST(request: NextRequest): Promise<Response> {
  const response = await handleApiRoute(request, async () => {
    const token = request.cookies.get(adminCookieName())?.value;
    if (!isProtectedMutation(request, "admin", token)) throw ApiError.authorization();
    const locale = resolveLocalePreference(request.cookies.get(LOCALE_COOKIE_NAME)?.value);
    await parseJsonRequest(request, emptyBodySchema, await getRequestValidationOptions(locale));
    if (token) await logoutAdmin(await connectToDatabase(), token);
    return apiSuccess({ authenticated: false as const });
  });
  if (response.ok) response.headers.append("set-cookie", clearAdminCookie());
  return response;
}
