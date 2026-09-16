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
  CustomerLoginRejectedError,
  customerCookieName,
  isSameOriginMutation,
  loginCustomer,
  serializeCustomerCookie,
} from "@/server/modules/auth";

export const runtime = "nodejs";

const loginSchema = z.strictObject({
  identifier: z.string().min(1).max(254),
  password: z.string().min(1).max(1024),
  persistent: z.boolean().default(false),
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
    try {
      const result = await loginCustomer(await connectToDatabase(), {
        ...input,
        priorToken: request.cookies.get(customerCookieName())?.value ?? null,
        userAgent: request.headers.get("user-agent")?.slice(0, 512) ?? null,
      });
      cookie = serializeCustomerCookie(
        result.session.token,
        result.session.expiresAt,
        result.persistent,
      );
      return apiSuccess({ authenticated: true as const, displayName: result.customer.displayName });
    } catch (error) {
      if (error instanceof CustomerLoginRejectedError)
        throw ApiError.authentication("Invalid credentials.");
      throw error;
    }
  });
  if (cookie && response.ok) response.headers.append("set-cookie", cookie);
  return response;
}
