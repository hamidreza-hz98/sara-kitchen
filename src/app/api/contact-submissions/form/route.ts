// route-response: html

import type { NextRequest } from "next/server";

import { LOCALE_COOKIE_NAME, resolveLocalePreference } from "@/locales/routing";
import { connectToDatabase } from "@/server/database";
import { ApiError, consumeRequestRateLimit } from "@/server/http";
import { isSameOriginMutation } from "@/server/modules/auth";
import { createApplicationLogger } from "@/server/observability";

import { contactReferrerHost, resolveContactFlow } from "../../contacts/route-helper";
import { ContactFormInputError, readContactFormInput } from "./contact-form-input";
import { htmlResponse } from "./html-response";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  const locale = resolveLocalePreference(request.cookies.get(LOCALE_COOKIE_NAME)?.value);
  return htmlResponse(locale, "form");
}

export async function POST(request: NextRequest): Promise<Response> {
  const locale = resolveLocalePreference(request.cookies.get(LOCALE_COOKIE_NAME)?.value);
  if (!isSameOriginMutation(request)) return htmlResponse(locale, "forbidden");
  let parsed;
  try {
    parsed = await readContactFormInput(request, locale);
  } catch (error) {
    if (error instanceof ContactFormInputError) return htmlResponse(locale, "invalid");
    throw error;
  }
  if (parsed.honeypot) return htmlResponse(locale, "sent");
  try {
    const connection = await connectToDatabase();
    await consumeRequestRateLimit(connection, request, {
      scope: "contact-create",
      limit: 5,
      windowMs: 10 * 60 * 1_000,
    });
    const requestId = crypto.randomUUID();
    await resolveContactFlow(connection, requestId, request.headers.get("user-agent")).createPublic(
      parsed.input,
      {
        pagePath: "/contact",
        referrerHost: contactReferrerHost(request),
        campaign: null,
        requestId,
      },
    );
    return htmlResponse(locale, "sent");
  } catch (error) {
    if (error instanceof ApiError && error.type === "rateLimit") {
      return htmlResponse(locale, "limited");
    }
    createApplicationLogger({ module: "contacts" }).error({
      action: "contact.form_submit_failed",
      message: "A public native contact form submission failed.",
      error,
    });
    return htmlResponse(locale, "error");
  }
}
