import "server-only";

import { unstable_cache } from "next/cache";

import { CONTENT_REVALIDATE_SECONDS, tagsForContentRead } from "@/server/cache";

import type { MutableSettingsSectionKey } from "../repository/settings-section";
import type { SettingsPublicCache } from "./settings-service";

/** Next Data Cache adapter. Each section owns an exact item tag and a finite stale-data backstop. */
export function createNextSettingsPublicCache(): SettingsPublicCache {
  const readers = new Map<string, () => Promise<unknown>>();

  return {
    read<Value>(key: MutableSettingsSectionKey, variant: string, load: () => Promise<Value>) {
      const cacheKey = `${key}:${variant}`;
      let reader = readers.get(cacheKey) as (() => Promise<Value>) | undefined;
      if (!reader) {
        reader = unstable_cache(load, ["sara-kitchen", "settings", key, variant], {
          revalidate: CONTENT_REVALIDATE_SECONDS,
          tags: [...tagsForContentRead("settings", { id: key })],
        });
        readers.set(cacheKey, reader as () => Promise<unknown>);
      }
      return reader();
    },
  };
}
