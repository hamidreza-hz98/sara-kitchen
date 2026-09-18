import { describe, expect, it } from "vitest";

import {
  CONTENT_AREAS,
  CONTENT_REVALIDATE_SECONDS,
  contentFetchCacheOptions,
  contentItemTag,
  contentListTag,
  createContentRevalidator,
  tagsForContentChange,
  tagsForContentRead,
} from "@/server/cache/policy";
import type { CacheTag } from "@/server/cache/policy";

describe("content cache policy", () => {
  it("defines bounded, deterministic tags for every content area", () => {
    expect(CONTENT_AREAS).toEqual([
      "settings",
      "categories",
      "ingredients",
      "dishes",
      "blogs",
      "seo",
    ]);
    expect(contentListTag("dishes")).toBe("sk:v1:dishes:list");
    expect(contentItemTag("dishes", "507f1f77bcf86cd799439011")).toBe(
      "sk:v1:dishes:item:507f1f77bcf86cd799439011",
    );
    for (const id of ["", "a/b", "..", "x".repeat(101)]) {
      expect(() => contentItemTag("dishes", id)).toThrow(TypeError);
    }
  });

  it("tags cached reads with their source dependencies and a 60-second backstop", () => {
    expect(
      tagsForContentRead("dishes", {
        id: "dish-1",
        dependencies: ["categories", "settings", "categories"],
      }),
    ).toEqual(["sk:v1:dishes:item:dish-1", "sk:v1:categories:list", "sk:v1:settings:list"]);
    expect(contentFetchCacheOptions("blogs")).toEqual({
      next: { tags: ["sk:v1:blogs:list"], revalidate: CONTENT_REVALIDATE_SECONDS },
    });
    expect(tagsForContentRead("seo", { id: "dish-1" })).toEqual([
      "sk:v1:seo:item:dish-1",
      "sk:v1:seo:list",
    ]);
  });

  it("invalidates list, affected detail and dependent SEO, without touching unrelated domains", () => {
    expect(tagsForContentChange({ area: "dishes", ids: ["dish-1", "dish-1"] })).toEqual([
      "sk:v1:dishes:list",
      "sk:v1:dishes:item:dish-1",
      "sk:v1:seo:list",
    ]);
    expect(tagsForContentChange({ area: "seo", ids: ["home"] })).toEqual([
      "sk:v1:seo:list",
      "sk:v1:seo:item:home",
    ]);
  });

  it("makes changed content visible without clearing an unrelated cached entry", () => {
    const cache = new Map<string, { tags: readonly CacheTag[]; value: string }>();
    const source = new Map([
      ["dish", "old dish"],
      ["blog", "old blog"],
      ["seo", "old title"],
    ]);
    const reads = [
      { key: "dish", tags: tagsForContentRead("dishes", { id: "dish-1" }) },
      { key: "blog", tags: tagsForContentRead("blogs", { id: "blog-1" }) },
      { key: "seo", tags: tagsForContentRead("seo", { dependencies: ["dishes", "blogs"] }) },
    ];
    const read = (key: string) => {
      const spec = reads.find((item) => item.key === key)!;
      let entry = cache.get(key);
      if (!entry) {
        entry = { tags: spec.tags, value: source.get(key)! };
        cache.set(key, entry);
      }
      return entry.value;
    };
    expect([read("dish"), read("blog"), read("seo")]).toEqual([
      "old dish",
      "old blog",
      "old title",
    ]);
    source.set("dish", "new dish");
    source.set("seo", "new title");
    const invalidate = createContentRevalidator((tag) => {
      for (const [key, entry] of cache) if (entry.tags.includes(tag)) cache.delete(key);
    });
    invalidate({ area: "dishes", ids: ["dish-1"] });
    expect(cache.has("blog")).toBe(true);
    expect([read("dish"), read("blog"), read("seo")]).toEqual([
      "new dish",
      "old blog",
      "new title",
    ]);
  });
});
