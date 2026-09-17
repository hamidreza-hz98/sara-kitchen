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
  PasswordResetRejectedError,
  clearCustomerCookie,
  isSameOriginMutation,
  limitPasswordResetSubmission,
  resetCustomerPassword,
} from "@/server/modules/auth";
import { isStrongSignupPassword } from "@/server/modules/customers";

export const runtime = "nodejs";

const schema = z.strictObject({
  token: z.string().min(1).max(64),
  newPassword: z.string().refine(isStrongSignupPassword),
});

export async function POST(request: NextRequest): Promise<Response> {
  const response = await handleApiRoute(request, async () => {
    if (!isSameOriginMutation(request)) throw ApiError.authorization();
    const locale = resolveLocalePreference(request.cookies.get(LOCALE_COOKIE_NAME)?.value);
    const connection = await connectToDatabase();
    await limitPasswordResetSubmission(connection, request);
    const input = await parseJsonRequest(
      request,
      schema,
      await getRequestValidationOptions(locale),
    );
    try {
      await resetCustomerPassword(connection, input.token, input.newPassword);
    } catch (error) {
      if (error instanceof PasswordResetRejectedError) {
        const t = await getTranslations({ locale, namespace: "storefront.resetPassword" });
        throw ApiError.validation(
          [{ code: "invalid_reset", message: t("invalid"), path: ["token"] }],
          t("invalid"),
        );
      }
      throw error;
    }
    return apiSuccess({ reset: true as const });
  });
  if (response.ok) response.headers.append("set-cookie", clearCustomerCookie());
  return response;
}
