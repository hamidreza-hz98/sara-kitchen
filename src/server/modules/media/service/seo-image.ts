import "server-only";

import { Types } from "mongoose";
import type { Connection } from "mongoose";

import type { SupportedLocale } from "@/constants";
import { resolveLocalizedValue } from "@/locales/translation-selection";

import { getMediaModel } from "../model/media";
import type { MediaAltTranslation, MediaDimensions, MediaVariant } from "../model/media";
import type { StorageProvider } from "../storage/storage-provider";

export type SeoMediaImage = Readonly<{
  url: string;
  alt: string | undefined;
  dimensions: MediaDimensions | null;
}>;

type SeoImageRecord = Readonly<{
  source: "managed" | "external";
  bucket: string | null;
  objectKey: string | null;
  externalUrl: string | null;
  dimensions: MediaDimensions | null;
  variants: readonly MediaVariant[];
  translations: readonly MediaAltTranslation[];
}>;

function preferredVariant(variants: readonly MediaVariant[]): MediaVariant | null {
  return (
    variants
      .filter(
        (variant) =>
          variant.processingState === "ready" &&
          (variant.mimeType === "image/jpeg" || variant.mimeType === "image/png"),
      )
      .toSorted((left, right) => {
        const leftPixels = (left.dimensions?.width ?? 0) * (left.dimensions?.height ?? 0);
        const rightPixels = (right.dimensions?.width ?? 0) * (right.dimensions?.height ?? 0);
        return rightPixels - leftPixels;
      })[0] ?? null
  );
}

/** Resolve an approved Media image to a short-lived crawler-readable URL. */
export async function resolveSeoMediaImage(
  connection: Connection,
  storage: StorageProvider,
  mediaId: string,
  locale: SupportedLocale,
): Promise<SeoMediaImage | null> {
  if (!Types.ObjectId.isValid(mediaId)) return null;
  const record = await getMediaModel(connection)
    .findOne({
      _id: new Types.ObjectId(mediaId),
      kind: "image",
      processingState: "ready",
      deletedAt: null,
    })
    .select({
      source: 1,
      bucket: 1,
      objectKey: 1,
      externalUrl: 1,
      dimensions: 1,
      variants: 1,
      translations: 1,
    })
    .lean<SeoImageRecord>()
    .exec();
  if (!record) return null;

  const alt = resolveLocalizedValue(record.translations, "alt", locale)?.value;
  if (record.source === "external") {
    return record.externalUrl
      ? { url: record.externalUrl, alt, dimensions: record.dimensions }
      : null;
  }
  if (!record.bucket || !record.objectKey) return null;

  const variant = preferredVariant(record.variants);
  const signed = await storage.signedReadUrl(
    { bucket: record.bucket, key: variant?.key ?? record.objectKey },
    900,
  );
  return {
    url: signed.url,
    alt,
    dimensions: variant?.dimensions ?? record.dimensions,
  };
}
