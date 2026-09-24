import "server-only";

import type { Metadata } from "next";

import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale } from "@/constants";
import { resolveTranslation } from "@/locales/translation-selection";

import type { SeoMetadataRecord } from "../repository/metadata-read";

export type SeoMetadataImage = Readonly<{
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}>;

export type SeoSiteMetadataSettings = Readonly<{
  siteUrl: string;
  siteName: string;
  icons: NonNullable<Metadata["icons"]>;
}>;

export type SeoMetadataFallback = Readonly<{
  title: string;
  description: string;
}>;

function absoluteUrl(siteUrl: string, path: string): string {
  return new URL(path, siteUrl).toString();
}

function languageAlternates(canonical: string, locales: readonly SupportedLocale[]) {
  return Object.fromEntries([
    ...locales.map((locale) => [locale, canonical] as const),
    ["x-default", canonical] as const,
  ]);
}

function openGraphLocale(locale: SupportedLocale): string {
  return locale.replace("-", "_");
}

function metadataBase(
  path: string,
  locale: SupportedLocale,
  title: string,
  description: string,
  settings: SeoSiteMetadataSettings,
): Metadata {
  const canonical = absoluteUrl(settings.siteUrl, path);
  return {
    metadataBase: new URL(settings.siteUrl),
    applicationName: settings.siteName,
    title,
    description,
    alternates: {
      canonical,
      languages: languageAlternates(canonical, SUPPORTED_LOCALES),
    },
    icons: settings.icons,
    openGraph: {
      type: "website",
      url: canonical,
      siteName: settings.siteName,
      locale: openGraphLocale(locale),
      title,
      description,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export function createFallbackNextMetadata(
  path: string,
  locale: SupportedLocale,
  fallback: SeoMetadataFallback,
  settings: SeoSiteMetadataSettings,
): Metadata {
  return metadataBase(path, locale, fallback.title, fallback.description, settings);
}

/** Convert the locale-aware SEO aggregate into the Next.js Metadata contract. */
export function createNextMetadata(
  record: SeoMetadataRecord,
  locale: SupportedLocale,
  settings: SeoSiteMetadataSettings,
  image: SeoMetadataImage | null = null,
): Metadata {
  const selection = resolveTranslation(record.translations, locale, {
    fallbackLocale: DEFAULT_LOCALE,
  });
  if (!selection) {
    throw new TypeError("SEO metadata requires a canonical translation.");
  }

  const translation = selection.value;
  const canonical = record.canonicalUrl ?? absoluteUrl(settings.siteUrl, record.path);
  const translatedLocales = record.translations.map(({ locale: value }) => value);
  const availableLocales = [...new Set(translatedLocales)];
  const openGraphTitle = translation.openGraph.title ?? translation.title;
  const openGraphDescription = translation.openGraph.description ?? translation.description;
  const twitterTitle = translation.twitter.title ?? openGraphTitle;
  const twitterDescription = translation.twitter.description ?? openGraphDescription;
  const images = image
    ? [
        {
          url: image.url,
          alt: image.alt ?? translation.title,
          ...(image.width === undefined ? {} : { width: image.width }),
          ...(image.height === undefined ? {} : { height: image.height }),
        },
      ]
    : undefined;

  return {
    metadataBase: new URL(settings.siteUrl),
    applicationName: settings.siteName,
    title: translation.title,
    description: translation.description,
    keywords: translation.keywords,
    alternates: {
      canonical,
      languages: languageAlternates(canonical, availableLocales),
    },
    icons: settings.icons,
    robots: {
      index: record.robots.index,
      follow: record.robots.follow,
      noarchive: record.robots.noArchive,
      noimageindex: record.robots.noImageIndex,
      nosnippet: record.robots.noSnippet,
      "max-snippet": record.robots.maxSnippet,
      "max-image-preview": record.robots.maxImagePreview,
      "max-video-preview": record.robots.maxVideoPreview,
      googleBot: {
        index: record.robots.index,
        follow: record.robots.follow,
        noarchive: record.robots.noArchive,
        noimageindex: record.robots.noImageIndex,
        nosnippet: record.robots.noSnippet,
        "max-snippet": record.robots.maxSnippet,
        "max-image-preview": record.robots.maxImagePreview,
        "max-video-preview": record.robots.maxVideoPreview,
      },
    },
    openGraph: {
      // Next's type list omits valid product/restaurant Open Graph values; preserve the stored value.
      type: record.openGraph.type as "website",
      url: canonical,
      siteName: record.openGraph.siteName ?? settings.siteName,
      locale: openGraphLocale(selection.resolvedLocale),
      alternateLocale: availableLocales
        .filter((value) => value !== selection.resolvedLocale)
        .map(openGraphLocale),
      title: openGraphTitle,
      description: openGraphDescription,
      ...(images ? { images } : {}),
    },
    twitter: {
      card: record.twitter.card,
      title: twitterTitle,
      description: twitterDescription,
      ...(record.twitter.site ? { site: record.twitter.site } : {}),
      ...(record.twitter.creator ? { creator: record.twitter.creator } : {}),
      ...(images ? { images } : {}),
    },
  };
}
