export const DEFAULT_LOCALE = "en" as const;

export const SUPPORTED_LOCALES = ["en", "pt-PT", "fa"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const RTL_LOCALES = ["fa"] as const satisfies readonly SupportedLocale[];

export function isSupportedLocale(value: string): value is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function isRtlLocale(locale: SupportedLocale): boolean {
  return (RTL_LOCALES as readonly SupportedLocale[]).includes(locale);
}
