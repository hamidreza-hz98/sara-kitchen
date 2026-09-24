import "server-only";

import type { Metadata } from "next";

import { PROJECT_NAME, type SupportedLocale } from "@/constants";
import { connectToDatabase } from "@/server/database";
import { getApplicationSiteUrl } from "@/server/environment";
import { createMinioStorageProvider, resolveSeoMediaImage } from "@/server/modules/media";
import { createApplicationLogger } from "@/server/observability";
import {
  createFallbackNextMetadata,
  createNextMetadata,
  createStructuredDataGraph,
  findSeoMetadataByPath,
  type SeoMetadataFallback,
  type SeoMetadataRecord,
  type SeoSiteMetadataSettings,
  type SeoStructuredDataType,
  type StructuredDataGraph,
  type StructuredDataSite,
} from "@/server/modules/seo";

const logger = createApplicationLogger({ module: "seo" });

function siteSettings(): SeoSiteMetadataSettings {
  return {
    siteUrl: getApplicationSiteUrl(),
    siteName: PROJECT_NAME,
    // The App Router's favicon file convention owns rel=icon; Settings owns additional icon roles.
    icons: { shortcut: ["/favicon.ico"] },
  };
}

function structuredDataSite(): StructuredDataSite {
  const url = getApplicationSiteUrl();
  return {
    url,
    name: PROJECT_NAME,
    logoUrl: new URL("/brand/sara-kitchen-logo.png", url).toString(),
  };
}

async function resolveImage(
  record: SeoMetadataRecord,
  locale: SupportedLocale,
): Promise<Awaited<ReturnType<typeof resolveSeoMediaImage>>> {
  if (!record.shareImageMediaId) return null;
  const connection = await connectToDatabase();
  return resolveSeoMediaImage(
    connection,
    createMinioStorageProvider(),
    record.shareImageMediaId,
    locale,
  );
}

/** Page adapter; persistent Settings can replace siteSettings without changing SEO mapping. */
export async function resolveStorefrontMetadata(
  path: string,
  locale: SupportedLocale,
  fallback: SeoMetadataFallback,
): Promise<Metadata> {
  const settings = siteSettings();
  try {
    const connection = await connectToDatabase();
    const record = await findSeoMetadataByPath(connection, path);
    if (!record) return createFallbackNextMetadata(path, locale, fallback, settings);
    const media = await resolveImage(record, locale);
    return createNextMetadata(
      record,
      locale,
      settings,
      media
        ? {
            url: media.url,
            ...(media.alt ? { alt: media.alt } : {}),
            ...(media.dimensions
              ? { width: media.dimensions.width, height: media.dimensions.height }
              : {}),
          }
        : null,
    );
  } catch (error) {
    logger.warn({
      action: "metadata.fallback",
      message: "Stored SEO metadata was unavailable; localized defaults were used.",
      context: { path, locale },
      error,
    });
    return createFallbackNextMetadata(path, locale, fallback, settings);
  }
}

export async function resolveStorefrontStructuredData(
  path: string,
  locale: SupportedLocale,
  fallback: SeoMetadataFallback,
  fallbackTypes: readonly SeoStructuredDataType[],
): Promise<StructuredDataGraph | null> {
  try {
    const connection = await connectToDatabase();
    const stored = await findSeoMetadataByPath(connection, path);
    const record: SeoMetadataRecord =
      stored ??
      ({
        path,
        canonicalUrl: null,
        translations: [
          {
            locale,
            title: fallback.title,
            description: fallback.description,
            keywords: [],
            openGraph: { title: null, description: null },
            twitter: { title: null, description: null },
          },
          ...(locale === "en"
            ? []
            : [
                {
                  locale: "en" as const,
                  title: fallback.title,
                  description: fallback.description,
                  keywords: [],
                  openGraph: { title: null, description: null },
                  twitter: { title: null, description: null },
                },
              ]),
        ],
        robots: {
          index: true,
          follow: true,
          noArchive: false,
          noImageIndex: false,
          noSnippet: false,
          maxSnippet: -1,
          maxImagePreview: "large",
          maxVideoPreview: -1,
        },
        openGraph: { type: "website", siteName: null },
        twitter: { card: "summary_large_image", creator: null, site: null },
        shareImageMediaId: null,
        structuredData: { types: [...fallbackTypes], inputs: {} },
        targetType: "static",
        entityKind: null,
      } satisfies SeoMetadataRecord);
    const media = await resolveImage(record, locale);
    return createStructuredDataGraph(
      record,
      locale,
      structuredDataSite(),
      media
        ? {
            url: media.url,
            ...(media.alt ? { alt: media.alt } : {}),
            ...(media.dimensions
              ? { width: media.dimensions.width, height: media.dimensions.height }
              : {}),
          }
        : null,
    );
  } catch (error) {
    logger.warn({
      action: "structured_data.omitted",
      message: "Structured data was unavailable and safely omitted.",
      context: { path, locale },
      error,
    });
    return null;
  }
}
