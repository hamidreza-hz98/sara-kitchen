import type { SupportedLocale } from "@/constants";

import { LOCALE_COOKIE_MAX_AGE, LOCALE_COOKIE_NAME } from "./routing";

/** Locale selection is browser-scoped, never an unverified customer identity field. */
export function saveBrowserLocalePreference(locale: SupportedLocale): void {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${LOCALE_COOKIE_NAME}=${encodeURIComponent(locale)}; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}
