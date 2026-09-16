import { describe, expect, it, vi } from "vitest";

import { normalizeSlug, resolveUniqueSlug } from "@/server/slugs/slug-policy";
import type { SlugPolicyError } from "@/server/slugs/slug-policy";

describe("slug policy", () => {
  it("normalizes Unicode Latin text, punctuation, whitespace, and special letters", () => {
    expect(normalizeSlug("  Crème d’Açafrão — Æsir & Straße!  ")).toBe(
      "creme-dacafrao-aesir-strasse",
    );
    expect(normalizeSlug("Chicken!!!   Tachin___Special")).toBe("chicken-tachin-special");
    expect(normalizeSlug("Dish № ۱۲ — ٤٢")).toBe("dish-no-12-42");
  });

  it("rejects sources that cannot produce an ASCII slug", () => {
    expect(() => normalizeSlug("🍲 غذای ایرانی")).toThrowError(
      expect.objectContaining<Partial<SlugPolicyError>>({ code: "invalid_slug_source" }),
    );
  });

  it("uses the lowest deterministic numeric suffix for duplicates", async () => {
    const taken = new Set(["fesenjan", "fesenjan-2"]);

    await expect(
      resolveUniqueSlug({
        canonicalText: "Fesenjan",
        isSlugTaken: (candidate) => taken.has(candidate),
      }),
    ).resolves.toEqual({
      collisionSuffix: 3,
      slug: "fesenjan-3",
      source: "generated",
    });
  });

  it("keeps a slug stable when the English title changes", async () => {
    const isSlugTaken = vi.fn(() => true);

    await expect(
      resolveUniqueSlug({
        canonicalText: "A completely new English title",
        currentSlug: "original-title",
        isSlugTaken,
      }),
    ).resolves.toEqual({
      collisionSuffix: null,
      slug: "original-title",
      source: "existing",
    });
    expect(isSlugTaken).not.toHaveBeenCalled();
  });

  it("applies and normalizes a deliberate admin override", async () => {
    await expect(
      resolveUniqueSlug({
        adminOverride: " Chef’s Choice 2026 ",
        canonicalText: "Ignored canonical title",
        currentSlug: "original-title",
      }),
    ).resolves.toEqual({
      collisionSuffix: null,
      slug: "chefs-choice-2026",
      source: "admin-override",
    });
  });

  it("treats system and module-specific reserved paths as occupied", async () => {
    await expect(resolveUniqueSlug({ canonicalText: "Menu" })).resolves.toEqual({
      collisionSuffix: 2,
      slug: "menu-2",
      source: "generated",
    });
    await expect(
      resolveUniqueSlug({ canonicalText: "Chef Picks", reservedSlugs: ["chef-picks"] }),
    ).resolves.toMatchObject({ collisionSuffix: 2, slug: "chef-picks-2" });
  });

  it("keeps the maximum length while adding collision suffixes", async () => {
    const canonicalText = "A very long Persian food title for a special seasonal celebration";
    const base = normalizeSlug(canonicalText, { maxLength: 24 });
    const result = await resolveUniqueSlug({
      canonicalText,
      isSlugTaken: (candidate) => candidate === base,
      maxLength: 24,
    });

    expect(result.slug).toBe("a-very-long-persian-fo-2");
    expect(result.slug).toHaveLength(24);
  });

  it("fails explicitly when its bounded candidate range is exhausted", async () => {
    await expect(
      resolveUniqueSlug({
        canonicalText: "Fesenjan",
        isSlugTaken: () => true,
        maxCandidates: 2,
      }),
    ).rejects.toMatchObject({ code: "slug_candidates_exhausted" });
  });
});
