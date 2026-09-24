import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { SETTINGS_SCHEMA_VERSION, migrateSettingsSectionDocument } from "@/server/modules/settings";
import type { SettingsMigrationError } from "@/server/modules/settings";

describe("settings migrations", () => {
  it("upgrades a version-one section sequentially and derives its immutable policy", () => {
    const result = migrateSettingsSectionDocument({
      key: "homepage",
      schemaVersion: 1,
      draft: { revision: 1 },
      published: null,
    });

    expect(result).toMatchObject({ fromVersion: 1, toVersion: 2, migrated: true });
    expect(result.document).toMatchObject({
      key: "homepage",
      schemaVersion: SETTINGS_SCHEMA_VERSION,
      publicationPolicy: "staged",
    });
  });

  it("is idempotent for current documents", () => {
    const current = {
      key: "contact",
      schemaVersion: SETTINGS_SCHEMA_VERSION,
      publicationPolicy: "direct",
    };
    const result = migrateSettingsSectionDocument(current);
    expect(result.migrated).toBe(false);
    expect(result.document).toEqual(current);
  });

  it.each([
    [{ key: "payments", schemaVersion: 1 }, "unknown_key"],
    [{ key: "homepage", schemaVersion: 0 }, "invalid_version"],
    [{ key: "homepage", schemaVersion: SETTINGS_SCHEMA_VERSION + 1 }, "future_version"],
  ] as const)("fails closed for an unsupported document: %j", (document, code) => {
    expect(() => migrateSettingsSectionDocument(document)).toThrowError(
      expect.objectContaining<Partial<SettingsMigrationError>>({ code }),
    );
  });
});
