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
  findSeoMetadataByPath,
  type SeoMetadataFallback,
  type SeoSiteMetadataSettings,
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
    const media = record.shareImageMediaId
      ? await resolveSeoMediaImage(
          connection,
          createMinioStorageProvider(),
          record.shareImageMediaId,
          locale,
        )
      : null;
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
