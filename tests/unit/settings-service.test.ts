import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  SettingsRepositoryConflictError,
  SettingsServiceError,
  createSettingsServices,
  summarizeSettingsDiff,
  type LanguageSettingsPayload,
  type MutableSettingsSectionKey,
  type SettingsPayloadEnvelope,
  type SettingsSectionRepository,
  type SettingsSectionSnapshot,
} from "@/server/modules/settings";

const owner = { id: "a".repeat(24), role: "owner" as const };
const manager = { id: "b".repeat(24), role: "manager" as const };
const viewer = { id: "c".repeat(24), role: "viewer" as const };

function languages(defaultLocale: "en" | "pt-PT" = "en"): LanguageSettingsPayload {
  return {
    data: {
      locales: [
        { locale: "en", visibility: "active", order: 0 },
        { locale: "pt-PT", visibility: "active", order: 1 },
        { locale: "fa", visibility: "hidden", order: 2 },
      ],
      defaultLocale,
      fallbackOrder: defaultLocale === "en" ? ["en", "pt-PT"] : ["pt-PT", "en"],
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
    ],
  };
}

function faq(title: string) {
  return {
    data: { entries: [] },
    translations: [{ locale: "en", value: { title, description: "", entries: [] } }],
  } as const;
}

function harness(options: { conflict?: boolean } = {}) {
  const records = new Map<MutableSettingsSectionKey, SettingsSectionSnapshot>();
  const cached = new Map<string, unknown>();
  const audit = vi.fn(async () => undefined);
  const invalidate = vi.fn((tag: string) => {
    const match = /^sk:v1:settings:item:(.+)$/u.exec(tag);
    if (match?.[1]) {
      for (const key of cached.keys()) {
        if (key.startsWith(`${match[1]}:`)) cached.delete(key);
      }
    }
  });
  let version = 0;

  function make(
    key: MutableSettingsSectionKey,
    current: SettingsSectionSnapshot | null,
    payload: SettingsPayloadEnvelope,
    publication: "draft" | "published",
    actorId: string,
    now: Date,
  ): SettingsSectionSnapshot {
    const revision = Math.max(current?.draft?.revision ?? 0, current?.published?.revision ?? 0) + 1;
    const revisionSnapshot = {
      payload: structuredClone(payload),
      revision,
      editedByAdminId: actorId,
      editedAt: now.toISOString(),
      publishedAt: publication === "published" ? now.toISOString() : null,
    };
    return {
      id: current?.id ?? String(records.size + 1).padStart(24, "0"),
      key,
      publicationPolicy: ["homepage", "about", "faq"].includes(key) ? "staged" : "direct",
      draft: publication === "draft" ? revisionSnapshot : null,
      published: publication === "published" ? revisionSnapshot : (current?.published ?? null),
      version: version++,
      createdAt: current?.createdAt ?? now.toISOString(),
      updatedAt: now.toISOString(),
    };
  }

  const repository: SettingsSectionRepository = {
    findByKey: async (key) => structuredClone(records.get(key) ?? null),
    saveDraft: async (current, key, payload, actorId, now) => {
      if (options.conflict) throw new SettingsRepositoryConflictError();
      const next = make(key, current, payload, "draft", actorId, now);
      records.set(key, next);
      return structuredClone(next);
    },
    saveDirect: async (current, key, payload, actorId, now) => {
      if (options.conflict) throw new SettingsRepositoryConflictError();
      const next = make(key, current, payload, "published", actorId, now);
      records.set(key, next);
      return structuredClone(next);
    },
    publishDraft: async (current, actorId, now) => {
      if (!current.draft) throw new SettingsRepositoryConflictError();
      const next: SettingsSectionSnapshot = {
        ...current,
        draft: null,
        published: {
          ...current.draft,
          editedByAdminId: actorId,
          publishedAt: now.toISOString(),
        },
        version: version++,
        updatedAt: now.toISOString(),
      };
      records.set(current.key, next);
      return structuredClone(next);
    },
  };
  const cache = {
    async read<Value>(
      key: MutableSettingsSectionKey,
      variant: string,
      load: () => Promise<Value>,
    ): Promise<Value> {
      const cacheKey = `${key}:${variant}`;
      if (!cached.has(cacheKey)) cached.set(cacheKey, await load());
      return structuredClone(cached.get(cacheKey)) as Value;
    },
  };
  return {
    audit,
    cached,
    invalidate,
    records,
    services: createSettingsServices({
      repository,
      cache,
      audit,
      invalidate,
      now: () => new Date("2026-09-25T12:00:00.000Z"),
    }),
  };
}

describe("settings service and cache behavior", () => {
  it("enforces read and section-specific update permissions", async () => {
    const test = harness();
    await expect(test.services.getAdmin(viewer, "languages")).resolves.toBeNull();
    await expect(test.services.update(viewer, "languages", languages())).rejects.toMatchObject({
      code: "forbidden",
    });
    await expect(test.services.update(manager, "languages", languages())).resolves.toMatchObject({
      key: "languages",
    });
    expect(test.audit).toHaveBeenCalledWith(expect.objectContaining({ outcome: "denied" }));
  });

  it("revalidates an exact direct section so the next cached read sees the update", async () => {
    const test = harness();
    await test.services.update(manager, "languages", languages("en"));
    expect((await test.services.getPublic("languages"))?.defaultLocale).toBe("en");
    expect(test.cached.has("languages:en:canonical")).toBe(true);

    await test.services.update(manager, "languages", languages("pt-PT"));
    expect(test.invalidate.mock.calls.map(([tag]) => tag)).toEqual(
      expect.arrayContaining([
        "sk:v1:settings:list",
        "sk:v1:settings:item:languages",
        "sk:v1:seo:list",
      ]),
    );
    expect((await test.services.getPublic("languages"))?.defaultLocale).toBe("pt-PT");
  });

  it("keeps staged edits private until publication and invalidates only on publish", async () => {
    const test = harness();
    const drafted = await test.services.update(manager, "faq", faq("Frequently asked questions"));
    expect(drafted).toMatchObject({ draft: { revision: 1 }, published: null });
    expect(await test.services.getPublic("faq")).toBeNull();
    expect(test.invalidate).not.toHaveBeenCalled();

    await test.services.publish(manager, "faq");
    expect(await test.services.getPublic("faq")).toEqual({ requestedLocale: "en", entries: [] });
    expect(test.invalidate).toHaveBeenCalledWith("sk:v1:settings:item:faq");
  });

  it("fails malformed payloads and maps optimistic conflicts", async () => {
    const test = harness();
    await expect(test.services.update(manager, "languages", {})).rejects.toBeInstanceOf(
      SettingsServiceError,
    );
    expect(test.records.size).toBe(0);

    const conflict = harness({ conflict: true });
    await expect(conflict.services.update(manager, "languages", languages())).rejects.toMatchObject(
      { code: "conflict" },
    );
  });

  it("produces bounded path-only audit summaries without storing changed values", () => {
    const previous = languages("en") as SettingsPayloadEnvelope;
    const nextPayload = languages("pt-PT");
    nextPayload.translations[0]!.value.displayNames[0]!.name = "Sensitive changed copy";
    const summary = summarizeSettingsDiff(previous, nextPayload as SettingsPayloadEnvelope, 2, 3);
    expect(summary).toMatchObject({ fromRevision: 2, toRevision: 3, truncated: false });
    expect(summary.changedPaths).toEqual([
      "data.defaultLocale",
      "data.fallbackOrder",
      "translations.en",
    ]);
    expect(JSON.stringify(summary)).not.toContain("Sensitive changed copy");
  });

  it("allows only staged sections to publish", async () => {
    const test = harness();
    await expect(test.services.publish(owner, "languages")).rejects.toMatchObject({
      code: "not_publishable",
    });
  });
});
