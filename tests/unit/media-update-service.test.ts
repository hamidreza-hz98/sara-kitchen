import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { MediaUpdateRepositoryConflictError, updateMediaMetadata } from "@/server/modules/media";
import type { MediaMetadataSnapshot, MediaUpdateRepository } from "@/server/modules/media";

const current: MediaMetadataSnapshot = {
  id: "507f1f77bcf86cd799439011",
  originalName: "meal.png",
  translations: [{ locale: "en", alt: "Meal" }],
  version: 3,
};

function harness(options: { missing?: boolean; conflict?: boolean } = {}) {
  let saved: Parameters<MediaUpdateRepository["saveMetadata"]> | null = null;
  const repository: MediaUpdateRepository = {
    findMetadata: async () => (options.missing ? null : current),
    async saveMetadata(...input) {
      saved = input;
      if (options.conflict) throw new MediaUpdateRepositoryConflictError();
      return {
        ...current,
        ...input[1],
        version: current.version + 1,
      };
    },
  };
  return { repository, saved: () => saved };
}

describe("media metadata update", () => {
  it("updates only a same-extension name and translated alt metadata", async () => {
    const test = harness();
    const result = await updateMediaMetadata(test.repository, {
      id: current.id,
      actorId: "507f191e810c19729de860ea",
      update: {
        originalName: "special meal.PNG",
        translations: [
          { locale: "en", alt: "Special meal" },
          { locale: "fa", alt: "غذای ویژه" },
        ],
      },
    });
    expect(result).toMatchObject({ originalName: "special meal.PNG" });
    expect(test.saved()?.[0]).toBe(current);
    expect(test.saved()?.[1]).toEqual({
      originalName: "special meal.PNG",
      translations: [
        { locale: "en", alt: "Special meal" },
        { locale: "fa", alt: "غذای ویژه" },
      ],
    });
  });

  it.each([
    [{ originalName: "meal.jpg" }, "extension_mismatch"],
    [{ originalName: "meal.final.png" }, "invalid_name"],
    [{ translations: [{ locale: "fa" as const, alt: "غذا" }] }, "invalid_translations"],
    [
      {
        translations: [
          { locale: "en" as const, alt: "Meal" },
          { locale: "en" as const, alt: "Duplicate" },
        ],
      },
      "invalid_translations",
    ],
  ])("rejects unsafe metadata without saving", async (update, code) => {
    const test = harness();
    await expect(
      updateMediaMetadata(test.repository, {
        id: current.id,
        actorId: "507f191e810c19729de860ea",
        update,
      }),
    ).rejects.toMatchObject({ code });
    expect(test.saved()).toBeNull();
  });

  it("reports not-found and optimistic conflicts with stable errors", async () => {
    await expect(
      updateMediaMetadata(harness({ missing: true }).repository, {
        id: current.id,
        actorId: "507f191e810c19729de860ea",
        update: { translations: current.translations },
      }),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(
      updateMediaMetadata(harness({ conflict: true }).repository, {
        id: current.id,
        actorId: "507f191e810c19729de860ea",
        update: { translations: current.translations },
      }),
    ).rejects.toMatchObject({ code: "conflict" });
  });
});
