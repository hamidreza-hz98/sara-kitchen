import type { NextRequest } from "next/server";
import { z } from "zod";

import { LOCALE_COOKIE_NAME, resolveLocalePreference } from "@/locales/routing";
import {
  apiSuccess,
  getRequestValidationOptions,
  handleApiRoute,
  parseQueryParameters,
} from "@/server/http";

const healthQuerySchema = z.strictObject({});

export function GET(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, async () => {
    const locale = resolveLocalePreference(request.cookies.get(LOCALE_COOKIE_NAME)?.value);
    const options = await getRequestValidationOptions(locale);
    parseQueryParameters(request, healthQuerySchema, options);
    return apiSuccess({ status: "ok" as const });
  });
}
