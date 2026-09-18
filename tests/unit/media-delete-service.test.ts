// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { MEDIA_RECYCLE_WINDOW_DAYS, deleteMediaSafely } from "@/server/modules/media";
import type { MediaDeleteRepository } from "@/server/modules/media";

const now = new Date("2026-09-18T10:00:00.000Z");

describe("safe media deletion", () => {
  it("soft-deletes unreferenced media and returns the recycle deadline", async () => {
    const repository: MediaDeleteRepository = {
      softDeleteUnreferenced: vi.fn().mockResolvedValue({ status: "deleted", deletedAt: now }),
    };

    await expect(
      deleteMediaSafely(repository, { id: "media-1", actorId: "admin-1", now }),
    ).resolves.toEqual({
      id: "media-1",
      deletedAt: "2026-09-18T10:00:00.000Z",
      purgeEligibleAt: "2026-10-18T10:00:00.000Z",
      recycleWindowDays: MEDIA_RECYCLE_WINDOW_DAYS,
    });
    expect(repository.softDeleteUnreferenced).toHaveBeenCalledWith("media-1", "admin-1", now);
  });

  it.each(["category", "dish", "blog", "settings"])(
    "blocks deletion when %s content contributes an active reference",
    async () => {
      const repository: MediaDeleteRepository = {
        softDeleteUnreferenced: vi
          .fn()
          .mockResolvedValue({ status: "referenced", referenceCount: 1 }),
      };

      await expect(
        deleteMediaSafely(repository, { id: "media-1", actorId: "admin-1", now }),
      ).rejects.toMatchObject({ code: "referenced", referenceCount: 1 });
    },
  );

  it("treats missing and already-recycled media identically", async () => {
    const repository: MediaDeleteRepository = {
      softDeleteUnreferenced: vi.fn().mockResolvedValue({ status: "not_found" }),
    };

    await expect(
      deleteMediaSafely(repository, { id: "media-1", actorId: "admin-1", now }),
    ).rejects.toMatchObject({ code: "not_found" });
  });
});
