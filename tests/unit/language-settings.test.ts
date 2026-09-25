import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  configuredFallbackOrder,
  parseLanguageSettings,
  projectPublicLanguageSettings,
  resolveConfiguredLocale,
  type LanguageSettingsPayload,
} from "@/server/modules/settings";

function payload(): LanguageSettingsPayload {
  return {
    data: {
      locales: [
        { locale: "en", visibility: "active", order: 0 },
        { locale: "pt-PT", visibility: "active", order: 1 },
        { locale: "fa", visibility: "maintenance", order: 2 },
      ],
      defaultLocale: "en",
      fallbackOrder: ["en", "pt-PT"],
    },
    translations: [
      {
        locale: "en",
        value: {
          displayNames: [
            { locale: "en", name: "English", shortName: "EN" },
            { locale: "pt-PT", name: "Portuguese", shortName: "PT" },
            { locale: "fa", name: "Persian", shortName: "FA" },
          ],
        },
      },
      {
        locale: "pt-PT",
        value: {
          displayNames: [
            { locale: "en", name: "Inglês", shortName: "EN" },
            { locale: "pt-PT", name: "Português", shortName: "PT" },
          ],
        },
      },
      {
        locale: "fa",
        value: {
          displayNames: [{ locale: "fa", name: "فارسی", shortName: "فا" }],
        },
      },
    ],
  };
}

describe("language settings", () => {
  it("accepts configured launch locales, an active default, and active-only fallback order", () => {
    expect(parseLanguageSettings(payload())).toEqual(payload());
  });

  it("requires every launch locale exactly once without requiring it to remain public", () => {
    const missing = payload();
    missing.data.locales[2] = { locale: "en", visibility: "hidden", order: 2 };
    expect(() => parseLanguageSettings(missing)).toThrow(/supported locale/u);
  });

  it("requires at least one active locale and an active default", () => {
    const noneActive = payload();
    noneActive.data.locales = noneActive.data.locales.map((locale) => ({
      ...locale,
      visibility: "hidden" as const,
    }));
    noneActive.data.fallbackOrder = [] as unknown as ["en"];
    expect(() => parseLanguageSettings(noneActive)).toThrow(/At least one locale/u);

    const invalidDefault = payload();
    invalidDefault.data.defaultLocale = "fa";
    expect(() => parseLanguageSettings(invalidDefault)).toThrow(/default locale must be active/u);
  });

  it("requires the fallback order to contain every active locale exactly once", () => {
    const missing = payload();
    missing.data.fallbackOrder = ["en"];
    expect(() => parseLanguageSettings(missing)).toThrow(/Fallback order/u);

    const maintenance = payload();
    maintenance.data.fallbackOrder = ["en", "pt-PT", "fa"];
    expect(() => parseLanguageSettings(maintenance)).toThrow(/Fallback order/u);
  });

  it("requires canonical names for all locales and rejects duplicate translated names", () => {
    const incompleteEnglish = payload();
    incompleteEnglish.translations[0]!.value.displayNames.pop();
    expect(() => parseLanguageSettings(incompleteEnglish)).toThrow(/name every supported/u);

    const duplicate = payload();
    duplicate.translations[1]!.value.displayNames[1] = {
      locale: "en",
      name: "English again",
      shortName: "EN2",
    };
    expect(() => parseLanguageSettings(duplicate)).toThrow(/must be unique/u);
  });

  it("projects active and maintenance locales while omitting hidden locales", () => {
    const hidden = payload();
    hidden.data.locales[1]!.visibility = "hidden";
    hidden.data.fallbackOrder = ["en"];
    const projected = projectPublicLanguageSettings(parseLanguageSettings(hidden), "fa");

    expect(projected).toEqual({
      defaultLocale: "en",
      fallbackOrder: ["en"],
      locales: [
        {
          locale: "en",
          name: "English",
          shortName: "EN",
          visibility: "active",
          selectable: true,
        },
        {
          locale: "fa",
          name: "فارسی",
          shortName: "فا",
          visibility: "maintenance",
          selectable: false,
        },
      ],
    });
  });

  it("uses per-name locale fallback and resolves stale browser preferences safely", () => {
    const parsed = parseLanguageSettings(payload());
    const projected = projectPublicLanguageSettings(parsed, "pt-PT");
    expect(projected.locales[2]).toMatchObject({ locale: "fa", name: "Persian" });
    expect(resolveConfiguredLocale(parsed, "pt-PT")).toBe("pt-PT");
    expect(resolveConfiguredLocale(parsed, "fa")).toBe("en");
    expect(resolveConfiguredLocale(parsed, undefined)).toBe("en");
    expect(configuredFallbackOrder(parsed, "en")).toEqual(["pt-PT"]);
  });
});
