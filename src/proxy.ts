import type { NextRequest, NextResponse as NextResponseType } from "next/server";
import { NextResponse } from "next/server";

import {
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_COOKIE_NAME,
  resolveLocalePreference,
} from "@/locales/routing";
import { isSupportedLocale } from "@/constants";

const INTERNAL_LOCALE_HEADER = "x-sara-kitchen-locale-rewrite";

function persistLocale(response: NextResponseType, locale: string) {
  response.cookies.set(LOCALE_COOKIE_NAME, locale, {
    maxAge: LOCALE_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export default function proxy(request: NextRequest) {
  if (request.headers.has(INTERNAL_LOCALE_HEADER)) {
    return NextResponse.next();
  }

  const [, pathnameLocale, ...remainingSegments] = request.nextUrl.pathname.split("/");

  if (pathnameLocale && isSupportedLocale(pathnameLocale)) {
    const publicUrl = request.nextUrl.clone();
    publicUrl.pathname = `/${remainingSegments.join("/")}`;
    const response = NextResponse.redirect(publicUrl);
    persistLocale(response, pathnameLocale);
    return response;
  }

  const cookieLocale = request.cookies.get(LOCALE_COOKIE_NAME)?.value;
  const locale = resolveLocalePreference(cookieLocale);
  const internalUrl = request.nextUrl.clone();
  internalUrl.pathname = `/${locale}${request.nextUrl.pathname === "/" ? "" : request.nextUrl.pathname}`;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(INTERNAL_LOCALE_HEADER, "1");
  requestHeaders.set("x-next-intl-locale", locale);

  const response = NextResponse.rewrite(internalUrl, {
    request: { headers: requestHeaders },
  });

  if (cookieLocale !== locale) {
    persistLocale(response, locale);
  }

  return response;
}

export const config = {
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
