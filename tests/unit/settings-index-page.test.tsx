// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const requireAdminPage = vi.hoisted(() => vi.fn().mockResolvedValue({}));
vi.mock("@/server/auth/page-guards", () => ({ requireAdminPage }));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }));

import SettingsIndexPage from "@/app/[locale]/(dashboard)/dashboard/settings/page";
import { SETTINGS_PAGE_SECTIONS } from "@/app/[locale]/(dashboard)/dashboard/settings/settings-section-registry";

describe("settings index", () => {
  it("renders links for every settings section after the read permission check", async () => {
    const markup = renderToStaticMarkup(await SettingsIndexPage());
    expect(requireAdminPage).toHaveBeenCalledWith("settings:read");
    for (const section of SETTINGS_PAGE_SECTIONS) {
      expect(markup).toContain(`href="/dashboard/settings/${section}"`);
    }
  });
});
