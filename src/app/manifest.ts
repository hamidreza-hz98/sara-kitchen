import type { MetadataRoute } from "next";
import { cookies } from "next/headers";

import { LOCALE_COOKIE_NAME, resolveLocalePreference } from "@/locales/routing";

import { createWebManifest } from "./manifest-data";

export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const cookieStore = await cookies();
  const locale = resolveLocalePreference(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
  return createWebManifest(locale);
}
