import { createConnection, Types } from "mongoose";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  SETTINGS_SCHEMA_VERSION,
  SETTINGS_SECTION_KEYS,
  getSettingsSectionModel,
  isSafeSettingsJsonObject,
  publicationPolicyForSettingsSection,
} from "@/server/modules/settings";

const SettingsSection = getSettingsSectionModel(createConnection());
const editor = new Types.ObjectId();

function revision(overrides: Record<string, unknown> = {}) {
  return {
    revision: 1,
    translations: [
      { locale: "en", value: { title: "Sara Kitchen" } },
      { locale: "fa", value: { title: "آشپزخانه سارا" } },
    ],
    data: { enabled: true },
    editedByAdminId: editor,
    editedAt: new Date("2026-09-24T12:00:00.000Z"),
    publishedAt: null,
    ...overrides,
  };
}

describe("settings section model", () => {
  it("defines all seven singleton sections and their explicit publication policy", () => {
    expect(SETTINGS_SECTION_KEYS).toEqual([
      "homepage",
      "contact",
      "social",
      "about",
      "faq",
      "terms",
      "languages",
    ]);
    expect(publicationPolicyForSettingsSection("homepage")).toBe("staged");
    expect(publicationPolicyForSettingsSection("contact")).toBe("direct");
  });

  it("accepts staged revisions with canonical translated content and editor provenance", async () => {
    const document = new SettingsSection({
      key: "homepage",
      publicationPolicy: "staged",
      draft: revision(),
      published: null,
    });

    await expect(document.validate()).resolves.toBeUndefined();
    expect(document.toJSON()).toMatchObject({
      id: document._id.toHexString(),
      key: "homepage",
      schemaVersion: SETTINGS_SCHEMA_VERSION,
    });
  });

  it("enforces direct and staged publication invariants", async () => {
    const published = revision({ publishedAt: new Date("2026-09-24T12:05:00.000Z") });
    await expect(
      new SettingsSection({
        key: "contact",
        publicationPolicy: "direct",
        draft: null,
        published,
      }).validate(),
    ).resolves.toBeUndefined();

    await expect(
      new SettingsSection({
        key: "contact",
        publicationPolicy: "direct",
        draft: revision(),
        published,
      }).validate(),
    ).rejects.toThrow(/draft/u);
    await expect(
      new SettingsSection({
        key: "about",
        publicationPolicy: "direct",
        draft: revision(),
      }).validate(),
    ).rejects.toThrow(/publicationPolicy/u);
    await expect(
      new SettingsSection({
        key: "faq",
        publicationPolicy: "staged",
        draft: revision({ revision: 1 }),
        published: revision({
          revision: 1,
          publishedAt: new Date("2026-09-24T12:05:00.000Z"),
        }),
      }).validate(),
    ).rejects.toThrow(/draft.revision/u);
  });

  it("rejects unknown keys, old shapes, invalid translations, and unsafe JSON", async () => {
    await expect(
      new SettingsSection({
        key: "payments",
        publicationPolicy: "direct",
        published: revision({ publishedAt: new Date() }),
      }).validate(),
    ).rejects.toThrow(/key/u);
    await expect(
      new SettingsSection({
        key: "homepage",
        publicationPolicy: "staged",
        schemaVersion: 1,
        draft: revision(),
      }).validate(),
    ).rejects.toThrow(/schemaVersion/u);
    await expect(
      new SettingsSection({
        key: "homepage",
        publicationPolicy: "staged",
        draft: revision({ translations: [{ locale: "fa", value: { title: "خانه" } }] }),
      }).validate(),
    ).rejects.toThrow(/translations/u);
    await expect(
      new SettingsSection({
        key: "homepage",
        publicationPolicy: "staged",
        draft: revision({ data: { $where: "unsafe" } }),
      }).validate(),
    ).rejects.toThrow(/data/u);
  });

  it("accepts only bounded acyclic plain JSON objects", () => {
    expect(isSafeSettingsJsonObject({ banner: { enabled: true }, order: [1, 2] })).toBe(true);
    expect(isSafeSettingsJsonObject([])).toBe(false);
    expect(isSafeSettingsJsonObject({ "unsafe.path": true })).toBe(false);
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(isSafeSettingsJsonObject(cyclic)).toBe(false);
  });
});
