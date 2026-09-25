import { beforeEach, describe, expect, it, vi } from "vitest";

const nextCache = vi.hoisted(() => ({
  options: [] as unknown[],
  unstableCache: vi.fn(
    <Value>(
      load: () => Promise<Value>,
      _keyParts: string[],
      options: unknown,
    ): (() => Promise<Value>) => {
      nextCache.options.push(options);
      let loaded = false;
      let value: Value;
      return async () => {
        if (!loaded) {
          value = await load();
          loaded = true;
        }
        return value;
      };
    },
  ),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  unstable_cache: nextCache.unstableCache,
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
}));

import { createNextSettingsPublicCache } from "@/server/modules/settings/service/settings-cache";

describe("Next settings cache adapter", () => {
  beforeEach(() => {
    nextCache.options.length = 0;
    nextCache.unstableCache.mockClear();
  });

  it("caches each public section under its exact tag with a finite lifetime", async () => {
    const cache = createNextSettingsPublicCache();
    const load = vi.fn(async () => null);
    await cache.read("languages", "en:canonical", load);
    await cache.read("languages", "en:canonical", load);

    expect(load).toHaveBeenCalledTimes(1);
    expect(nextCache.unstableCache).toHaveBeenCalledTimes(1);
    expect(nextCache.options).toEqual([
      { revalidate: 60, tags: ["sk:v1:settings:item:languages"] },
    ]);
  });
});
