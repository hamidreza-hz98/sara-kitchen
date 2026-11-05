import type { NextRequest } from "next/server";

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
  createCustomerMobileVerification,
  isSameOriginMutation,
  limitSignupIdentity,
  limitSignupIp,
  mobileVerificationDevelopmentCodeEnabled,
} from "@/server/modules/auth";
import { customerSignupSchema, registerCustomer } from "@/server/modules/customers";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, async () => {
    if (!isSameOriginMutation(request)) throw ApiError.authorization();
    const connection = await connectToDatabase();
    await limitSignupIp(connection, request);
    const locale = resolveLocalePreference(request.cookies.get(LOCALE_COOKIE_NAME)?.value);
    const input = await parseJsonRequest(
      request,
      customerSignupSchema,
      await getRequestValidationOptions(locale),
    );
    await limitSignupIdentity(connection, input.mobile);
    if (input.email) await limitSignupIdentity(connection, input.email, "email");
    const customerId = await registerCustomer(connection, input);
    if (customerId && mobileVerificationDevelopmentCodeEnabled()) {
      const mobileVerification = await createCustomerMobileVerification(connection, {
        customerId,
        mobile: input.mobile,
      });
      return apiSuccess({ accepted: true as const, mobileVerification }, { status: 202 });
    }
    return apiSuccess({ accepted: true as const }, { status: 202 });
  });
}
