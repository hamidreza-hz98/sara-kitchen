import { defineRouting } from "next-intl/routing";

import { DEFAULT_LOCALE, SUPPORTED_LOCALES, isSupportedLocale } from "@/constants";

export const LOCALE_COOKIE_NAME = "SARA_LOCALE";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const routing = defineRouting({
  locales: SUPPORTED_LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "never",
  localeDetection: false,
  localeCookie: {
    name: LOCALE_COOKIE_NAME,
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax",
  },
});

export function resolveLocalePreference(value: string | undefined) {
  return value && isSupportedLocale(value) ? value : DEFAULT_LOCALE;
}
