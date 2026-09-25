import type { SupportedLocale } from "@/constants";
import { buildLocaleResolutionOrder } from "@/locales/translation-selection";

import type { LanguageSettingsPayload, LanguageVisibility } from "../validation/language-settings";

export type PublicLanguageOption = Readonly<{
  locale: SupportedLocale;
  name: string;
  shortName: string;
  visibility: Exclude<LanguageVisibility, "hidden">;
  selectable: boolean;
}>;

export type PublicLanguageSettings = Readonly<{
  defaultLocale: SupportedLocale;
  fallbackOrder: readonly SupportedLocale[];
  locales: readonly PublicLanguageOption[];
}>;

function displayNameFor(
  payload: LanguageSettingsPayload,
  targetLocale: SupportedLocale,
  requestedLocale: SupportedLocale,
  fallbackLocale?: SupportedLocale | null,
) {
  const translations = new Map(
    payload.translations.map((translation) => [translation.locale, translation.value.displayNames]),
  );
  for (const { locale } of buildLocaleResolutionOrder(requestedLocale, {
    ...(fallbackLocale !== undefined ? { fallbackLocale } : {}),
  })) {
    const displayName = translations.get(locale)?.find((entry) => entry.locale === targetLocale);
    if (displayName) return displayName;
  }
  throw new Error(`language_display_name_unavailable:${targetLocale}`);
}

/**
 * Returns selector-ready locale metadata. Hidden locales are omitted; maintenance locales remain
 * visible but cannot be selected, making planned downtime explicit without deleting configuration.
 */
export function projectPublicLanguageSettings(
  payload: LanguageSettingsPayload,
  requestedLocale: SupportedLocale,
  fallbackLocale?: SupportedLocale | null,
): PublicLanguageSettings {
  return {
    defaultLocale: payload.data.defaultLocale,
    fallbackOrder: payload.data.fallbackOrder,
    locales: payload.data.locales
      .filter(({ visibility }) => visibility !== "hidden")
      .toSorted(
        (left, right) => left.order - right.order || left.locale.localeCompare(right.locale),
      )
      .map((configured) => {
        const displayName = displayNameFor(
          payload,
          configured.locale,
          requestedLocale,
          fallbackLocale,
        );
        return {
          locale: configured.locale,
          name: displayName.name,
          shortName: displayName.shortName,
          visibility: configured.visibility as "active" | "maintenance",
          selectable: configured.visibility === "active",
        };
      }),
  };
}

/** Resolves stale or unavailable browser preferences to the configured active default. */
export function resolveConfiguredLocale(
  payload: LanguageSettingsPayload,
  preferredLocale: SupportedLocale | null | undefined,
): SupportedLocale {
  return payload.data.locales.some(
    ({ locale, visibility }) => locale === preferredLocale && visibility === "active",
  ) && preferredLocale
    ? preferredLocale
    : payload.data.defaultLocale;
}

/** Builds an active-only content lookup order without repeating the requested locale. */
export function configuredFallbackOrder(
  payload: LanguageSettingsPayload,
  requestedLocale: SupportedLocale,
): readonly SupportedLocale[] {
  return payload.data.fallbackOrder.filter((locale) => locale !== requestedLocale);
}
