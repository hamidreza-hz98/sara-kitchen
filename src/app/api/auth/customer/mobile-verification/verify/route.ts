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
  CustomerMobileVerificationRejectedError,
  createVerifiedCustomerSession,
  customerCookieName,
  isSameOriginMutation,
  limitVerificationAttempt,
  mobileVerificationDevelopmentCodeEnabled,
  serializeCustomerCookie,
  verifyCustomerMobile,
} from "@/server/modules/auth";

export const runtime = "nodejs";

const schema = z.strictObject({
  challengeToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/u),
  code: z.string().regex(/^\d{6}$/u),
});

export async function POST(request: NextRequest): Promise<Response> {
  let cookie: string | undefined;
  const response = await handleApiRoute(request, async () => {
    if (!isSameOriginMutation(request)) throw ApiError.authorization();
    if (!mobileVerificationDevelopmentCodeEnabled()) throw ApiError.serviceUnavailable();
    const locale = resolveLocalePreference(request.cookies.get(LOCALE_COOKIE_NAME)?.value);
    const connection = await connectToDatabase();
    const input = await parseJsonRequest(
      request,
      schema,
      await getRequestValidationOptions(locale),
    );
    await limitVerificationAttempt(connection, request, input.challengeToken);
    try {
      const customerId = await verifyCustomerMobile(connection, input);
      const result = await createVerifiedCustomerSession(connection, {
        customerId,
        priorToken: request.cookies.get(customerCookieName())?.value ?? null,
        userAgent: request.headers.get("user-agent")?.slice(0, 512) ?? null,
      });
      cookie = serializeCustomerCookie(
        result.session.token,
        result.session.expiresAt,
        result.persistent,
      );
      return apiSuccess({ authenticated: true as const, verified: true as const });
    } catch (error) {
      if (error instanceof CustomerMobileVerificationRejectedError) {
        const t = await getTranslations({ locale, namespace: "storefront.mobileVerification" });
        throw ApiError.validation(
          [{ code: "invalid_mobile_verification", message: t("invalid"), path: ["code"] }],
          t("invalid"),
        );
      }
      throw error;
    }
  });
  if (cookie && response.ok) response.headers.append("set-cookie", cookie);
  return response;
}
