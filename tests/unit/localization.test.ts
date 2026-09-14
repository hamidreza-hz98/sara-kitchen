import { describe, expect, it } from "vitest";

import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@/constants";
import { loadMessages } from "@/locales/messages";
import {
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_COOKIE_NAME,
  resolveLocalePreference,
  routing,
} from "@/locales/routing";

function messageKeys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return [prefix];
  }

  return Object.entries(value).flatMap(([key, child]) =>
    messageKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe("next-intl localization contract", () => {
  it("uses clean URLs and the agreed persistent locale cookie", () => {
    expect(routing.locales).toEqual(SUPPORTED_LOCALES);
    expect(routing.defaultLocale).toBe(DEFAULT_LOCALE);
    expect(routing.localePrefix).toBe("never");
    expect(routing.localeDetection).toBe(false);
    expect(routing.localeCookie).toMatchObject({
      name: LOCALE_COOKIE_NAME,
      maxAge: LOCALE_COOKIE_MAX_AGE,
      sameSite: "lax",
    });
  });

  it.each(SUPPORTED_LOCALES)("loads the complete %s message catalog", async (locale) => {
    const englishMessages = await loadMessages("en");
    const localizedMessages = await loadMessages(locale);

    expect(messageKeys(localizedMessages).sort()).toEqual(messageKeys(englishMessages).sort());
  });

  it("falls back to English for missing or invalid browser preferences", () => {
    expect(resolveLocalePreference(undefined)).toBe("en");
    expect(resolveLocalePreference("de")).toBe("en");
    expect(resolveLocalePreference("pt")).toBe("en");
    expect(resolveLocalePreference("pt-PT")).toBe("pt-PT");
    expect(resolveLocalePreference("fa")).toBe("fa");
  });
});
