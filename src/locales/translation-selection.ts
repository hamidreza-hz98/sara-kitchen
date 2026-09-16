import { DEFAULT_LOCALE, isRtlLocale, type SupportedLocale } from "@/constants";

export type LocalizedEntry = {
  locale: SupportedLocale;
};

export type LocalizedField<Translation extends LocalizedEntry> = Extract<
  Exclude<keyof Translation, "locale">,
  string
>;

export type LocaleResolutionSource = "requested" | "configured-fallback" | "canonical";

export type LocaleResolutionCandidate = {
  locale: SupportedLocale;
  source: LocaleResolutionSource;
};

export type LocaleResolutionOptions = {
  fallbackLocale?: SupportedLocale | null;
};

export type LocalizedSelection<Value> = {
  direction: "ltr" | "rtl";
  isFallback: boolean;
  requestedLocale: SupportedLocale;
  resolvedLocale: SupportedLocale;
  source: LocaleResolutionSource;
  value: Value;
};

function addCandidate(
  candidates: LocaleResolutionCandidate[],
  seen: Set<SupportedLocale>,
  locale: SupportedLocale,
  source: LocaleResolutionSource,
): void {
  if (seen.has(locale)) return;
  seen.add(locale);
  candidates.push({ locale, source });
}

/** Build the exact requested → configured fallback → canonical lookup sequence. */
export function buildLocaleResolutionOrder(
  requestedLocale: SupportedLocale,
  options: LocaleResolutionOptions = {},
): readonly LocaleResolutionCandidate[] {
  const candidates: LocaleResolutionCandidate[] = [];
  const seen = new Set<SupportedLocale>();

  addCandidate(candidates, seen, requestedLocale, "requested");
  if (options.fallbackLocale) {
    addCandidate(candidates, seen, options.fallbackLocale, "configured-fallback");
  }
  addCandidate(candidates, seen, DEFAULT_LOCALE, "canonical");

  return candidates;
}

function createSelection<Value>(
  value: Value,
  requestedLocale: SupportedLocale,
  candidate: LocaleResolutionCandidate,
): LocalizedSelection<Value> {
  return {
    direction: isRtlLocale(candidate.locale) ? "rtl" : "ltr",
    isFallback: candidate.locale !== requestedLocale,
    requestedLocale,
    resolvedLocale: candidate.locale,
    source: candidate.source,
    value,
  };
}

function hasLocalizedValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  return typeof value !== "string" || value.trim().length > 0;
}

/** Resolve a complete translation entry, or `null` when no candidate locale exists. */
export function resolveTranslation<Translation extends LocalizedEntry>(
  translations: readonly Translation[] | null | undefined,
  requestedLocale: SupportedLocale,
  options: LocaleResolutionOptions = {},
): LocalizedSelection<Translation> | null {
  if (!translations || translations.length === 0) return null;

  for (const candidate of buildLocaleResolutionOrder(requestedLocale, options)) {
    const translation = translations.find(({ locale }) => locale === candidate.locale);
    if (translation) return createSelection(translation, requestedLocale, candidate);
  }

  return null;
}

/**
 * Resolve one localized field independently. Missing, null, and blank-string values continue
 * through the fallback chain; `false`, `0`, structured rich text, and other defined values do not.
 */
export function resolveLocalizedValue<
  Translation extends LocalizedEntry,
  Field extends LocalizedField<Translation>,
>(
  translations: readonly Translation[] | null | undefined,
  field: Field,
  requestedLocale: SupportedLocale,
  options: LocaleResolutionOptions = {},
): LocalizedSelection<NonNullable<Translation[Field]>> | null {
  if (!translations || translations.length === 0) return null;

  for (const candidate of buildLocaleResolutionOrder(requestedLocale, options)) {
    const translation = translations.find(({ locale }) => locale === candidate.locale);
    const value = translation?.[field];
    if (hasLocalizedValue(value)) {
      return createSelection(value as NonNullable<Translation[Field]>, requestedLocale, candidate);
    }
  }

  return null;
}
