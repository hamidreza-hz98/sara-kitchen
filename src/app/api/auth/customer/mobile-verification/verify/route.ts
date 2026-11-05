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
  isSameOriginMutation,
  limitVerificationAttempt,
  mobileVerificationDevelopmentCodeEnabled,
  verifyCustomerMobile,
} from "@/server/modules/auth";

export const runtime = "nodejs";

const schema = z.strictObject({
  challengeToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/u),
  code: z.string().regex(/^\d{6}$/u),
});

export async function POST(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, async () => {
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
      await verifyCustomerMobile(connection, input);
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
    return apiSuccess({ verified: true as const });
  });
}
