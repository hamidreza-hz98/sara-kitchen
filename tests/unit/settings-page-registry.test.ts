import { describe, expect, it } from "vitest";

import {
  SETTINGS_PAGE_REGISTRY,
  SETTINGS_PAGE_SECTIONS,
  createInitialSettingsPayload,
  isSettingsPageSection,
} from "@/app/[locale]/(dashboard)/dashboard/settings/settings-section-registry";

describe("settings page registry", () => {
  it("registers exactly the seven approved settings sections", () => {
    expect(SETTINGS_PAGE_SECTIONS).toEqual([
      "homepage",
      "contact",
      "social",
      "about",
      "faq",
      "terms",
      "languages",
    ]);
    expect(Object.keys(SETTINGS_PAGE_REGISTRY)).toEqual(SETTINGS_PAGE_SECTIONS);
  });

  it("rejects invalid dynamic route values", () => {
    expect(isSettingsPageSection("homepage")).toBe(true);
    expect(isSettingsPageSection("unknown")).toBe(false);
    expect(isSettingsPageSection("__proto__")).toBe(false);
  });

  it("provides canonical English bootstrap content for every form", () => {
    for (const section of SETTINGS_PAGE_SECTIONS) {
      const payload = createInitialSettingsPayload(section);
      expect(payload.translations).toEqual(
        expect.arrayContaining([expect.objectContaining({ locale: "en" })]),
      );
    }
  });
});
