// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ requireAdminPage: vi.fn(), notFound: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  notFound: state.notFound,
}));
vi.mock("@/server/auth/page-guards", () => ({
  requireAdminPage: state.requireAdminPage,
}));
vi.mock("@/app/[locale]/(dashboard)/dashboard/settings/[section]/settings-section-editor", () => ({
  SettingsSectionEditor: () => null,
}));

import SettingsSectionPage from "@/app/[locale]/(dashboard)/dashboard/settings/[section]/page";

describe("settings dynamic page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.notFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });
    state.requireAdminPage.mockResolvedValue({ role: "owner" });
  });

  it("renders every registry section behind settings read authorization", async () => {
    await expect(
      SettingsSectionPage({ params: Promise.resolve({ section: "homepage" }) }),
    ).resolves.toBeTruthy();
    expect(state.requireAdminPage).toHaveBeenCalledWith("settings:read");
  });

  it("terminates invalid section URLs with not-found before database access", async () => {
    await expect(
      SettingsSectionPage({ params: Promise.resolve({ section: "invalid" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(state.notFound).toHaveBeenCalledOnce();
    expect(state.requireAdminPage).not.toHaveBeenCalled();
  });
});
