import type { NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
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
  changeCurrentCustomerPassword,
  CustomerPasswordChangeRejectedError,
  customerCookieName,
  isProtectedMutation,
  serializeCustomerCookie,
} from "@/server/modules/auth";
import { isStrongSignupPassword } from "@/server/modules/customers";

export const runtime = "nodejs";

const schema = z.strictObject({
  currentPassword: z.string().min(1).max(1024),
  newPassword: z.string().refine(isStrongSignupPassword),
  revokeOtherSessions: z.boolean(),
});

export async function POST(request: NextRequest): Promise<Response> {
  let cookie: string | undefined;
  const response = await handleApiRoute(request, async () => {
    const token = request.cookies.get(customerCookieName())?.value;
    if (!token) throw ApiError.authentication();
    if (!isProtectedMutation(request, "customer", token)) throw ApiError.authorization();
    const locale = resolveLocalePreference(request.cookies.get(LOCALE_COOKIE_NAME)?.value);
    const input = await parseJsonRequest(
      request,
      schema,
      await getRequestValidationOptions(locale),
    );
    const t = await getTranslations({ locale, namespace: "profile.changePassword" });
    try {
      const result = await changeCurrentCustomerPassword(await connectToDatabase(), {
        ...input,
        token,
        userAgent: request.headers.get("user-agent")?.slice(0, 512) ?? null,
      });
      cookie = serializeCustomerCookie(
        result.session.token,
        result.session.expiresAt,
        result.persistent,
      );
      return apiSuccess({
        changed: true as const,
        otherSessionsRevoked: input.revokeOtherSessions,
      });
    } catch (error) {
      if (error instanceof CustomerPasswordChangeRejectedError) {
        if (error.reason === "session") throw ApiError.authentication();
        if (error.reason === "stale") throw ApiError.conflict();
        const path = error.reason === "current" ? "currentPassword" : "newPassword";
        const message = t(error.reason === "current" ? "invalidCurrent" : "mustDiffer");
        throw ApiError.validation([{ code: error.reason, message, path: [path] }], message);
      }
      throw error;
    }
  });
  if (cookie && response.ok) response.headers.append("set-cookie", cookie);
  return response;
}
