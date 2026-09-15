import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@/constants";
import { getIntlMessageFallback, reportIntlError } from "@/locales/message-errors";
import { loadMessages, mergeMessageCatalogs } from "@/locales/messages";
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
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

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

  it("exposes the agreed message namespaces", async () => {
    const messages = await loadMessages("en");

    expect(Object.keys(messages).sort()).toEqual(
      ["shared", "validation", "storefront", "profile", "dashboard", "entities", "errors"].sort(),
    );
  });

  it("falls back to an English leaf when a localized leaf is unavailable", () => {
    expect(
      mergeMessageCatalogs(
        { shared: { save: "Save", cancel: "Cancel" } },
        { shared: { save: "Guardar" } },
      ),
    ).toEqual({ shared: { save: "Guardar", cancel: "Cancel" } });
  });

  it("warns visibly and renders an explicit marker for unknown keys in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    reportIntlError({ code: "MISSING_MESSAGE", message: "Missing errors.example" });

    expect(warning).toHaveBeenCalledWith("[localization:MISSING_MESSAGE] Missing errors.example");
    expect(
      getIntlMessageFallback({
        error: { code: "MISSING_MESSAGE", message: "Missing errors.example" },
        key: "example",
        namespace: "errors",
      }),
    ).toBe("⟦missing: errors.example⟧");
  });

  it("falls back to English for missing or invalid browser preferences", () => {
    expect(resolveLocalePreference(undefined)).toBe("en");
    expect(resolveLocalePreference("de")).toBe("en");
    expect(resolveLocalePreference("pt")).toBe("en");
    expect(resolveLocalePreference("pt-PT")).toBe("pt-PT");
    expect(resolveLocalePreference("fa")).toBe("fa");
  });
});
