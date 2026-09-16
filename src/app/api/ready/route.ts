import type { NextRequest } from "next/server";
import { z } from "zod";

import { LOCALE_COOKIE_NAME, resolveLocalePreference } from "@/locales/routing";
import {
  ApiError,
  apiSuccess,
  getRequestValidationOptions,
  handleApiRoute,
  parseQueryParameters,
} from "@/server/http";
import { getReadiness } from "@/server/health/probes";

const readyQuerySchema = z.strictObject({});

export function GET(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, async () => {
    const locale = resolveLocalePreference(request.cookies.get(LOCALE_COOKIE_NAME)?.value);
    parseQueryParameters(request, readyQuerySchema, await getRequestValidationOptions(locale));
    const report = await getReadiness();
    if (report.status !== "ready") throw ApiError.unavailable(report.dependencies);
    return apiSuccess(report);
  });
}
