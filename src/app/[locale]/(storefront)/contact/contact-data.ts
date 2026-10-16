import "server-only";

import { unstable_cache } from "next/cache";

import type { SupportedLocale } from "@/constants";
import { CONTENT_REVALIDATE_SECONDS, contentItemTag } from "@/server/cache";
import { connectToDatabase } from "@/server/database";
import {
  createSettingsRuntime,
  type PublicContactSettings,
  type PublicSocialSettings,
} from "@/server/modules/settings";

export type ContactPageData = Readonly<{
  contact: PublicContactSettings | null;
  social: PublicSocialSettings | null;
}>;

async function readContactPageData(locale: SupportedLocale): Promise<ContactPageData> {
  const connection = await connectToDatabase();
  const settings = createSettingsRuntime(connection, { requestId: "contact-render" });
  const [contact, social] = await Promise.all([
    settings.getPublic("contact", locale),
    settings.getPublic("social", locale),
  ]);
  return { contact, social };
}

export function loadContactPageData(locale: SupportedLocale): Promise<ContactPageData> {
  return unstable_cache(() => readContactPageData(locale), ["contact-page", locale], {
    revalidate: CONTENT_REVALIDATE_SECONDS,
    tags: [contentItemTag("settings", "contact"), contentItemTag("settings", "social")],
  })();
}
