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
  resendCustomerMobileVerification,
} from "@/server/modules/auth";

export const runtime = "nodejs";

const schema = z.strictObject({ challengeToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/u) });

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
      const mobileVerification = await resendCustomerMobileVerification(
        connection,
        input.challengeToken,
      );
      return apiSuccess({ mobileVerification });
    } catch (error) {
      if (error instanceof CustomerMobileVerificationRejectedError) {
        const t = await getTranslations({ locale, namespace: "storefront.mobileVerification" });
        throw ApiError.validation(
          [
            {
              code: "invalid_mobile_verification",
              message: t("invalid"),
              path: ["challengeToken"],
            },
          ],
          t("invalid"),
        );
      }
      throw error;
    }
  });
}
