import "server-only";

import { pageResult } from "@/server/database";

import type { MediaReadRecord, MediaReadRepository } from "../repository/media-read";
import type { StorageProvider } from "../storage/storage-provider";
import type { MediaListQueryPlan } from "../validation/media-read-query";

export const MEDIA_READ_URL_TTL_SECONDS = 300;

type MediaAccess = Readonly<{ url: string; expiresAt: string | null }>;
type MediaVariantDto = Readonly<{
  mimeType: string;
  bytes: number;
  dimensions: MediaReadRecord["dimensions"];
  processingState: string;
  access: MediaAccess | null;
}>;

export type MediaListItemDto = Readonly<{
  id: string;
  originalName: string;
  mimeType: string;
  kind: string;
  bytes: number | null;
  dimensions: MediaReadRecord["dimensions"];
  processingState: string;
  translations: MediaReadRecord["translations"];
  uploaderId: string;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
  preview: MediaAccess | null;
}>;

export type MediaDetailDto = MediaListItemDto &
  Readonly<{
    source: string;
    durationMs: number | null;
    pageCount: number | null;
    failureCode: string | null;
    original: MediaAccess | null;
    variants: readonly MediaVariantDto[];
  }>;

async function accessFor(
  storage: StorageProvider,
  record: Pick<MediaReadRecord, "source" | "bucket" | "objectKey" | "externalUrl">,
  key = record.objectKey,
): Promise<MediaAccess | null> {
  if (record.source === "external") {
    return record.externalUrl ? { url: record.externalUrl, expiresAt: null } : null;
  }
  if (!record.bucket || !key) return null;
  const signed = await storage.signedReadUrl(
    { bucket: record.bucket, key },
    MEDIA_READ_URL_TTL_SECONDS,
  );
  return { url: signed.url, expiresAt: signed.expiresAt.toISOString() };
}

function base(record: MediaReadRecord, preview: MediaAccess | null): MediaListItemDto {
  return {
    id: record.id,
    originalName: record.originalName,
    mimeType: record.mimeType,
    kind: record.kind,
    bytes: record.bytes,
    dimensions: record.dimensions,
    processingState: record.processingState,
    translations: record.translations,
    uploaderId: record.uploaderId,
    usageCount: record.usageCount,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    preview,
  };
}

function previewKey(record: MediaReadRecord): string | null {
  const ready = record.variants
    .filter((variant) => variant.processingState === "ready")
    .toSorted((left, right) => left.bytes - right.bytes);
  return ready[0]?.key ?? record.objectKey;
}

async function mapBounded<T, R>(
  values: readonly T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<readonly R[]> {
  const results = Array<R>(values.length);
  let cursor = 0;
  const worker = async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      const value = values[index];
      if (value === undefined) return;
      results[index] = await mapper(value);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => worker()),
  );
  return results;
}

export async function listMedia(
  repository: MediaReadRepository,
  storage: StorageProvider,
  plan: MediaListQueryPlan,
) {
  const result = await repository.list(plan);
  const items = await mapBounded(result.items, 5, async (record) =>
    base(
      record,
      record.processingState === "ready"
        ? await accessFor(storage, record, previewKey(record))
        : null,
    ),
  );
  return pageResult(items, result.total, plan);
}

export async function getMediaDetail(
  repository: MediaReadRepository,
  storage: StorageProvider,
  id: string,
): Promise<MediaDetailDto | null> {
  const record = await repository.findById(id);
  if (!record) return null;
  const [original, variants] = await Promise.all([
    record.processingState === "ready" ? accessFor(storage, record) : null,
    mapBounded(record.variants, 5, async (variant): Promise<MediaVariantDto> => ({
      mimeType: variant.mimeType,
      bytes: variant.bytes,
      dimensions: variant.dimensions,
      processingState: variant.processingState,
      access:
        variant.processingState === "ready" ? await accessFor(storage, record, variant.key) : null,
    })),
  ]);
  const selectedPreviewKey = previewKey(record);
  const previewVariantIndex = record.variants.findIndex(
    (variant) => variant.key === selectedPreviewKey,
  );
  const preview =
    previewVariantIndex >= 0 ? (variants[previewVariantIndex]?.access ?? null) : original;
  return {
    ...base(record, preview),
    source: record.source,
    durationMs: record.durationMs,
    pageCount: record.pageCount,
    failureCode: record.failureCode,
    original,
    variants,
  };
}
