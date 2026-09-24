import "server-only";

import type { Connection } from "mongoose";

import { getPageSeoModel } from "../model/page-seo";
import type {
  PageSeoTranslation,
  SeoOpenGraphData,
  SeoRobotsDirectives,
  SeoStructuredData,
  SeoTwitterData,
  SeoEntityKind,
  SeoTargetType,
} from "../model/page-seo";

export type SeoMetadataRecord = Readonly<{
  path: string;
  translations: readonly PageSeoTranslation[];
  canonicalUrl: string | null;
  robots: SeoRobotsDirectives;
  openGraph: SeoOpenGraphData;
  twitter: SeoTwitterData;
  shareImageMediaId: string | null;
  structuredData: SeoStructuredData;
  targetType: SeoTargetType;
  entityKind: SeoEntityKind | null;
}>;

/** Public-safe SEO projection used by Next.js metadata generation. */
export async function findSeoMetadataByPath(
  connection: Connection,
  path: string,
): Promise<SeoMetadataRecord | null> {
  const record = await getPageSeoModel(connection)
    .findOne({ path, active: true, deletedAt: null })
    .select({
      path: 1,
      translations: 1,
      canonicalUrl: 1,
      robots: 1,
      openGraph: 1,
      twitter: 1,
      shareImageMediaId: 1,
      structuredData: 1,
      targetType: 1,
      entityKind: 1,
    })
    .lean()
    .exec();
  if (!record) return null;
  return {
    path: record.path,
    translations: record.translations,
    canonicalUrl: record.canonicalUrl,
    robots: record.robots,
    openGraph: record.openGraph,
    twitter: record.twitter,
    shareImageMediaId: record.shareImageMediaId?.toHexString() ?? null,
    structuredData: record.structuredData,
    targetType: record.targetType,
    entityKind: record.entityKind,
  };
}
