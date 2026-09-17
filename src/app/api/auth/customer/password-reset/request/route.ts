import { after, type NextRequest } from "next/server";
import { z } from "zod";

import { LOCALE_COOKIE_NAME, resolveLocalePreference } from "@/locales/routing";
import { connectToDatabase } from "@/server/database";
import { getApplicationSiteUrl } from "@/server/environment";
import {
  ApiError,
  apiSuccess,
  getRequestValidationOptions,
  handleApiRoute,
  parseJsonRequest,
} from "@/server/http";
import {
  isSameOriginMutation,
  limitPasswordResetRequest,
  requestCustomerPasswordReset,
  resetSmsEnabled,
  sendResetSms,
} from "@/server/modules/auth";
import { createApplicationLogger } from "@/server/observability";

export const runtime = "nodejs";
export const maxDuration = 15;

const schema = z.strictObject({ identifier: z.string().trim().min(1).max(254) });

export async function POST(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    if (!isSameOriginMutation(request)) throw ApiError.authorization();
    const locale = resolveLocalePreference(request.cookies.get(LOCALE_COOKIE_NAME)?.value);
    const input = await parseJsonRequest(
      request,
      schema,
      await getRequestValidationOptions(locale),
    );
    const connection = await connectToDatabase();
    await limitPasswordResetRequest(connection, request, input.identifier);
    if (!resetSmsEnabled()) {
      if (process.env.NODE_ENV === "production")
        throw ApiError.internal(undefined, "Password reset SMS must be configured for production.");
      return apiSuccess({ accepted: true as const }, { status: 202 });
    }
    const siteUrl = getApplicationSiteUrl();
    after(async () => {
      try {
        await requestCustomerPasswordReset(
          connection,
          { identifier: input.identifier, locale, siteUrl },
          sendResetSms,
        );
      } catch (error) {
        // Never log the bearer, mobile, identifier, or provider response.
        createApplicationLogger({ module: "auth.password-reset", requestId }).error({
          action: "delivery.failed",
          error,
          message: "Customer password-reset delivery failed.",
        });
      }
    });
    return apiSuccess({ accepted: true as const }, { status: 202 });
  });
}
