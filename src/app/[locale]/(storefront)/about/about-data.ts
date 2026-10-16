import "server-only";

import { unstable_cache } from "next/cache";

import type { SupportedLocale } from "@/constants";
import { CONTENT_REVALIDATE_SECONDS, contentItemTag } from "@/server/cache";
import { connectToDatabase } from "@/server/database";
import {
  createMediaReadRepository,
  createMinioStorageProvider,
  getMediaDetail,
  resolveStorefrontMediaImage,
} from "@/server/modules/media";
import { createSettingsRuntime } from "@/server/modules/settings";

import type { AboutContent, AboutImage } from "./about-content";
import { projectAboutContent } from "./about-projection";

async function readAboutContent(locale: SupportedLocale): Promise<AboutContent | null> {
  const connection = await connectToDatabase();
  const settings = await createSettingsRuntime(connection, {
    requestId: "about-render",
  }).getPublic("about", locale);
  if (!settings) return null;
  const storage = createMinioStorageProvider();
  const images = new Map<string, Promise<AboutImage | null>>();
  const image = (id: string, alt: string): Promise<AboutImage | null> => {
    let pending = images.get(id);
    if (!pending) {
      pending = resolveStorefrontMediaImage(connection, storage, id, locale, "display")
        .then((found) => (found ? { url: found.url, alt: found.alt || "" } : null))
        .catch(() => null);
      images.set(id, pending);
    }
    return pending.then((found) => (found ? { ...found, alt: alt || found.alt } : null));
  };
  const mediaRepository = createMediaReadRepository(connection);
  return projectAboutContent(settings, locale, image, async (id, kind) => {
    if (kind === "image") {
      const found = await image(id, "");
      return found ? { kind, url: found.url } : null;
    }
    try {
      const detail = await getMediaDetail(mediaRepository, storage, id);
      return detail?.kind === "video" && detail.processingState === "ready" && detail.original
        ? { kind, url: detail.original.url }
        : null;
    } catch {
      return null;
    }
  });
}

/** About content changes are invalidated by the Settings publication tag. */
export function loadAboutContent(locale: SupportedLocale): Promise<AboutContent | null> {
  return unstable_cache(() => readAboutContent(locale), ["about-content", locale], {
    revalidate: CONTENT_REVALIDATE_SECONDS,
    tags: [contentItemTag("settings", "about")],
  })();
}
