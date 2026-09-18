"use client";

import { fetchCsrfToken } from "./csrf-client";

export const MEDIA_BULK_UPLOAD_POLICY = {
  maxFiles: 10,
  defaultConcurrency: 2,
  maxConcurrency: 3,
  maxRetries: 2,
  retryBaseDelayMs: 250,
} as const;

export type MediaAltTranslation = Readonly<{
  locale: "en" | "pt-PT" | "fa";
  alt: string;
}>;

export type MediaBulkUploadItem = Readonly<{
  clientId: string;
  file: File;
  translations: readonly MediaAltTranslation[];
}>;

export type MediaBulkUploadStage = "queued" | "uploading" | "retrying" | "succeeded" | "failed";

export type MediaBulkUploadProgress = Readonly<{
  clientId: string;
  fileName: string;
  index: number;
  stage: MediaBulkUploadStage;
  progress: number;
  attempt: number;
}>;

export type MediaUploadSuccess = Readonly<{
  id: string;
  checksum: string;
  variantCount: number;
}>;

export type MediaBulkUploadResult = Readonly<{
  clientId: string;
  fileName: string;
  index: number;
  status: "succeeded" | "failed";
  progress: 100;
  attempts: number;
  media: MediaUploadSuccess | null;
  error: Readonly<{ code: string; retryable: boolean }> | null;
}>;

export type MediaBulkUploadSummary = Readonly<{
  total: number;
  succeeded: number;
  failed: number;
  retried: number;
}>;

export type MediaBulkUploadReport = Readonly<{
  items: readonly MediaBulkUploadResult[];
  summary: MediaBulkUploadSummary;
}>;

export class MediaBulkUploadError extends Error {
  constructor(readonly code: "aborted" | "batch_empty" | "duplicate_client_id" | "too_many_files") {
    super(code);
    this.name = "MediaBulkUploadError";
  }
}

export class MediaUploadTransportError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
    readonly retryAfterMs: number | null = null,
  ) {
    super(code);
    this.name = "MediaUploadTransportError";
  }
}

export type MediaUploadTransport = (
  item: MediaBulkUploadItem,
  context: Readonly<{
    csrfToken: string;
    signal?: AbortSignal;
    onProgress: (progress: number) => void;
  }>,
) => Promise<MediaUploadSuccess>;

export type MediaBulkUploadOptions = Readonly<{
  concurrency?: number;
  csrfToken?: string;
  maxRetries?: number;
  signal?: AbortSignal;
  onProgress?: (event: MediaBulkUploadProgress) => void;
  transport?: MediaUploadTransport;
  sleep?: (milliseconds: number) => Promise<void>;
}>;

function retryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function retryAfterMilliseconds(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1_000, 5_000);
  const date = Date.parse(value);
  if (!Number.isFinite(date)) return null;
  return Math.min(Math.max(0, date - Date.now()), 5_000);
}

function responseErrorCode(value: unknown, status: number): string {
  if (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof value.error === "object" &&
    value.error !== null &&
    "code" in value.error &&
    typeof value.error.code === "string"
  ) {
    return value.error.code;
  }
  return `HTTP_${status}`;
}

function successData(value: unknown): MediaUploadSuccess | null {
  if (typeof value !== "object" || value === null || !("data" in value)) return null;
  const data = value.data;
  if (
    typeof data !== "object" ||
    data === null ||
    !("id" in data) ||
    !("checksum" in data) ||
    !("variantCount" in data) ||
    typeof data.id !== "string" ||
    typeof data.checksum !== "string" ||
    typeof data.variantCount !== "number"
  ) {
    return null;
  }
  return { id: data.id, checksum: data.checksum, variantCount: data.variantCount };
}

/** Browser transport for the atomic single-file endpoint. */
export const uploadMediaWithProgress: MediaUploadTransport = (item, context) =>
  new Promise((resolve, reject) => {
    if (context.signal?.aborted) {
      reject(new MediaUploadTransportError("aborted", false));
      return;
    }
    const request = new XMLHttpRequest();
    const abort = () => request.abort();
    context.signal?.addEventListener("abort", abort, { once: true });
    request.open("POST", "/api/media");
    request.responseType = "json";
    request.setRequestHeader("x-csrf-token", context.csrfToken);
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && event.total > 0) {
        context.onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
      }
    });
    request.addEventListener("load", () => {
      context.signal?.removeEventListener("abort", abort);
      if (request.status >= 200 && request.status < 300) {
        const data = successData(request.response);
        if (data) resolve(data);
        else reject(new MediaUploadTransportError("INVALID_RESPONSE", false));
        return;
      }
      reject(
        new MediaUploadTransportError(
          responseErrorCode(request.response, request.status),
          retryableStatus(request.status),
          retryAfterMilliseconds(request.getResponseHeader("retry-after")),
        ),
      );
    });
    request.addEventListener("error", () => {
      context.signal?.removeEventListener("abort", abort);
      reject(new MediaUploadTransportError("NETWORK_ERROR", true));
    });
    request.addEventListener("abort", () => {
      context.signal?.removeEventListener("abort", abort);
      reject(new MediaUploadTransportError("aborted", false));
    });
    const form = new FormData();
    form.append("file", item.file);
    form.append("translations", JSON.stringify(item.translations));
    request.send(form);
  });

function validateBatch(items: readonly MediaBulkUploadItem[]): void {
  if (items.length === 0) throw new MediaBulkUploadError("batch_empty");
  if (items.length > MEDIA_BULK_UPLOAD_POLICY.maxFiles) {
    throw new MediaBulkUploadError("too_many_files");
  }
  if (new Set(items.map((item) => item.clientId)).size !== items.length) {
    throw new MediaBulkUploadError("duplicate_client_id");
  }
}

function boundedInteger(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  label: string,
): number {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${label} must be an integer from ${minimum} to ${maximum}.`);
  }
  return value;
}

function transportError(error: unknown): MediaUploadTransportError {
  if (error instanceof MediaUploadTransportError) return error;
  return new MediaUploadTransportError("UNKNOWN_ERROR", false);
}

/**
 * Upload a batch through independent atomic requests. The worker pool is bounded,
 * output order matches input order, and one failure never rejects the whole batch.
 */
export async function uploadMediaBatch(
  items: readonly MediaBulkUploadItem[],
  options: MediaBulkUploadOptions = {},
): Promise<MediaBulkUploadReport> {
  validateBatch(items);
  const concurrency = boundedInteger(
    options.concurrency,
    MEDIA_BULK_UPLOAD_POLICY.defaultConcurrency,
    1,
    MEDIA_BULK_UPLOAD_POLICY.maxConcurrency,
    "concurrency",
  );
  const maxRetries = boundedInteger(
    options.maxRetries,
    MEDIA_BULK_UPLOAD_POLICY.maxRetries,
    0,
    MEDIA_BULK_UPLOAD_POLICY.maxRetries,
    "maxRetries",
  );
  const transport = options.transport ?? uploadMediaWithProgress;
  const sleep =
    options.sleep ??
    ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const csrfToken = options.csrfToken ?? (await fetchCsrfToken("admin"));
  const results = Array<MediaBulkUploadResult>(items.length);
  let cursor = 0;

  const notify = (
    index: number,
    stage: MediaBulkUploadStage,
    progress: number,
    attempt: number,
  ) => {
    const item = items[index];
    if (!item) return;
    options.onProgress?.({
      clientId: item.clientId,
      fileName: item.file.name,
      index,
      stage,
      progress,
      attempt,
    });
  };
  items.forEach((_, index) => notify(index, "queued", 0, 0));

  const worker = async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      const item = items[index];
      if (!item) return;
      let attempt = 0;
      for (;;) {
        if (options.signal?.aborted) {
          results[index] = {
            clientId: item.clientId,
            fileName: item.file.name,
            index,
            status: "failed",
            progress: 100,
            attempts: attempt,
            media: null,
            error: { code: "aborted", retryable: false },
          };
          notify(index, "failed", 100, attempt);
          break;
        }
        attempt += 1;
        notify(index, "uploading", 0, attempt);
        try {
          const media = await transport(item, {
            csrfToken,
            ...(options.signal ? { signal: options.signal } : {}),
            onProgress: (progress) => notify(index, "uploading", progress, attempt),
          });
          results[index] = {
            clientId: item.clientId,
            fileName: item.file.name,
            index,
            status: "succeeded",
            progress: 100,
            attempts: attempt,
            media,
            error: null,
          };
          notify(index, "succeeded", 100, attempt);
          break;
        } catch (error) {
          const failure = transportError(error);
          if (failure.retryable && attempt <= maxRetries && !options.signal?.aborted) {
            notify(index, "retrying", 0, attempt);
            await sleep(
              failure.retryAfterMs ??
                MEDIA_BULK_UPLOAD_POLICY.retryBaseDelayMs * 2 ** (attempt - 1),
            );
            continue;
          }
          results[index] = {
            clientId: item.clientId,
            fileName: item.file.name,
            index,
            status: "failed",
            progress: 100,
            attempts: attempt,
            media: null,
            error: { code: failure.code, retryable: failure.retryable },
          };
          notify(index, "failed", 100, attempt);
          break;
        }
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => worker()),
  );
  const succeeded = results.filter((result) => result.status === "succeeded").length;
  return {
    items: results,
    summary: {
      total: results.length,
      succeeded,
      failed: results.length - succeeded,
      retried: results.filter((result) => result.attempts > 1).length,
    },
  };
}
