import type { SupportedLocale } from "@/constants";
import { resolveTranslation } from "@/locales/translation-selection";

import type {
  SocialIconKey,
  SocialPlatform,
  SocialSettingsPayload,
  SocialSettingsTranslation,
} from "../validation/social-settings";

const HANDLE_BASES: Readonly<Record<SocialPlatform, string>> = Object.freeze({
  instagram: "https://www.instagram.com/",
  facebook: "https://www.facebook.com/",
  whatsapp: "https://wa.me/",
  telegram: "https://t.me/",
  linkedin: "https://www.linkedin.com/in/",
  youtube: "https://www.youtube.com/@",
  tiktok: "https://www.tiktok.com/@",
  x: "https://x.com/",
  threads: "https://www.threads.net/@",
  pinterest: "https://www.pinterest.com/",
  snapchat: "https://www.snapchat.com/add/",
});

export type PublicSocialLink = Readonly<{
  platform: SocialPlatform;
  label: string;
  href: string;
  iconKey: SocialIconKey;
  order: number;
  target: "_blank";
  rel: "noopener noreferrer";
}>;

export type PublicSocialSettings = Readonly<{
  locale: Readonly<{
    requested: SupportedLocale;
    resolved: SupportedLocale;
    isFallback: boolean;
  }>;
  links: readonly PublicSocialLink[];
}>;

function hrefFor(
  platform: SocialPlatform,
  destination: SocialSettingsPayload["data"]["links"][number]["destination"],
): string {
  if (destination.type === "url") return new URL(destination.url).toString();
  const normalized = destination.handle.replace(/^@/u, "");
  const segment = platform === "whatsapp" ? normalized.replace(/^\+/u, "") : normalized;
  return `${HANDLE_BASES[platform]}${encodeURIComponent(segment)}`;
}

/** Produces render-ready anchors without accepting executable markup or client-provided rel/target values. */
export function projectPublicSocialSettings(
  payload: SocialSettingsPayload,
  requestedLocale: SupportedLocale,
  fallbackLocale?: SupportedLocale | null,
): PublicSocialSettings {
  const translations: SocialSettingsTranslation[] = payload.translations;
  const selection = resolveTranslation(translations, requestedLocale, {
    ...(fallbackLocale !== undefined ? { fallbackLocale } : {}),
  });
  if (!selection) throw new Error("social_translation_unavailable");
  const labels = new Map(selection.value.value.labels.map(({ id, label }) => [id, label]));
  const canonicalLabels = new Map(
    payload.translations
      .find(({ locale }) => locale === "en")
      ?.value.labels.map(({ id, label }) => [id, label]) ?? [],
  );

  return {
    locale: {
      requested: requestedLocale,
      resolved: selection.resolvedLocale,
      isFallback: selection.isFallback,
    },
    links: payload.data.links
      .filter(({ active }) => active)
      .toSorted((left, right) => left.order - right.order || left.id.localeCompare(right.id))
      .map((link) => ({
        platform: link.platform,
        label: labels.get(link.id) ?? canonicalLabels.get(link.id) ?? link.platform,
        href: hrefFor(link.platform, link.destination),
        iconKey: link.iconKey,
        order: link.order,
        target: "_blank" as const,
        rel: "noopener noreferrer" as const,
      })),
  };
}
