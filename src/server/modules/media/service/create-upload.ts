import "server-only";

import { createHash } from "node:crypto";

import { SUPPORTED_LOCALES } from "@/constants";
import type { SupportedLocale } from "@/constants";

import { processImageForRoute } from "../processing/serverless-processing";
import type { ImageMimeType } from "../processing/image-processor";
import type { MediaUploadRepository } from "../repository/media-upload";
import { createMediaObjectKey } from "../storage/minio-provider";
import type { StorageObjectRef, StorageProvider } from "../storage/storage-provider";
import { UPLOAD_POLICY, inspectUploadBatch } from "../validation/upload-policy";
import type { UploadCandidate } from "../validation/upload-policy";

export type MediaUploadErrorCode =
  "duplicate" | "invalid_translations" | "unsupported_mvp" | "quota_exceeded" | "rollback_failed";

export class MediaUploadError extends Error {
  constructor(readonly code: MediaUploadErrorCode) {
    super(code);
    this.name = "MediaUploadError";
  }
}

export interface CreateMediaUploadInput {
  readonly actorId: string;
  readonly bucket: string;
  readonly candidate: UploadCandidate;
  readonly translations: readonly { readonly locale: SupportedLocale; readonly alt: string }[];
}

export interface CreateMediaUploadDependencies {
  readonly repository: MediaUploadRepository;
  readonly storage: StorageProvider;
}

function validateTranslations(translations: CreateMediaUploadInput["translations"]): void {
  const locales = new Set<string>();
  for (const entry of translations) {
    if (
      !SUPPORTED_LOCALES.includes(entry.locale) ||
      locales.has(entry.locale) ||
      entry.alt.trim().length < 1 ||
      entry.alt.length > 500
    ) {
      throw new MediaUploadError("invalid_translations");
    }
    locales.add(entry.locale);
  }
  if (!locales.has("en")) throw new MediaUploadError("invalid_translations");
}

function bufferStream(data: Buffer): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(Uint8Array.from(data));
      controller.close();
    },
  });
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

/** Create one ready image only after every private object upload succeeds. */
export async function createMediaUpload(
  deps: CreateMediaUploadDependencies,
  input: CreateMediaUploadInput,
): Promise<{ id: string; checksum: string; variantCount: number }> {
  validateTranslations(input.translations);
  const quota = await deps.repository.quotaUsage(input.actorId);
  const [inspected] = await inspectUploadBatch([input.candidate], quota);
  if (!inspected || inspected.kind !== "image") throw new MediaUploadError("unsupported_mvp");
  const data = Buffer.from(await input.candidate.blob.arrayBuffer());
  if (data.length !== inspected.bytes) throw new MediaUploadError("unsupported_mvp");
  const checksum = createHash("sha256").update(data).digest("hex");
  if (await deps.repository.findActiveByChecksum(checksum)) {
    throw new MediaUploadError("duplicate");
  }
  const processed = await processImageForRoute(data, inspected.mimeType as ImageMimeType);
  const derivedBytes = processed.variants.reduce((sum, variant) => sum + variant.bytes, 0);
  if (quota.activeStorageBytes + data.length + derivedBytes > UPLOAD_POLICY.maxActiveStorageBytes) {
    throw new MediaUploadError("quota_exceeded");
  }

  const attempted: StorageObjectRef[] = [];
  try {
    const originalRef = {
      bucket: input.bucket,
      key: createMediaObjectKey("originals", inspected.extension),
    };
    attempted.push(originalRef);
    await deps.storage.upload({
      ...originalRef,
      contentLength: data.length,
      contentType: inspected.mimeType,
      body: bufferStream(data),
    });
    const variants = [];
    for (const variant of processed.variants) {
      const ref = {
        bucket: input.bucket,
        key: createMediaObjectKey("variants", variant.extension),
      };
      attempted.push(ref);
      await deps.storage.upload({
        ...ref,
        contentLength: variant.bytes,
        contentType: variant.mimeType,
        body: bufferStream(variant.data),
      });
      variants.push({
        key: ref.key,
        mimeType: variant.mimeType,
        bytes: variant.bytes,
        dimensions: { width: variant.width, height: variant.height },
        checksum: variant.checksum,
        processingState: "ready" as const,
        failureCode: null,
      });
    }
    const created = await deps.repository.create({
      originalName: inspected.name,
      objectKey: originalRef.key,
      bucket: input.bucket,
      mimeType: inspected.mimeType,
      bytes: data.length,
      checksum,
      dimensions: { width: processed.source.width, height: processed.source.height },
      variants,
      translations: input.translations,
      uploaderId: input.actorId,
    });
    return { id: created.id, checksum, variantCount: variants.length };
  } catch (error) {
    const failures: StorageObjectRef[] = [];
    for (const ref of attempted.reverse()) {
      let removed = false;
      for (let attempt = 0; attempt < 3 && !removed; attempt += 1) {
        try {
          await deps.storage.delete(ref);
          removed = true;
        } catch {
          // A transient object-store failure may clear before the next attempt.
        }
      }
      if (!removed) failures.push(ref);
    }
    if (failures.length > 0) throw new MediaUploadError("rollback_failed");
    if (isDuplicateKey(error)) throw new MediaUploadError("duplicate");
    throw error;
  }
}
