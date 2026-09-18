export const MEDIA_KINDS = ["image", "video", "pdf", "other"] as const;
export const MEDIA_SOURCES = ["managed", "external"] as const;
export const MEDIA_PROVIDERS = ["minio", "external"] as const;
export const MEDIA_PROCESSING_STATES = ["pending", "processing", "ready", "failed"] as const;
export const MEDIA_FAILURE_CODES = [
  "storage_error",
  "unsupported_file",
  "processing_error",
  "metadata_error",
  "unknown",
] as const;

export type MediaKind = (typeof MEDIA_KINDS)[number];
export type MediaSource = (typeof MEDIA_SOURCES)[number];
export type MediaProvider = (typeof MEDIA_PROVIDERS)[number];
export type MediaProcessingState = (typeof MEDIA_PROCESSING_STATES)[number];
export type MediaFailureCode = (typeof MEDIA_FAILURE_CODES)[number];

export const MEDIA_CHECKSUM_PATTERN = /^[a-f0-9]{64}$/u;
export const MEDIA_MIME_PATTERN = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/iu;
export const MEDIA_BUCKET_PATTERN = /^(?!\d+\.\d+\.\d+\.\d+$)[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/u;

export function isSafeMediaObjectKey(value: string): boolean {
  return (
    value.length >= 1 &&
    value.length <= 512 &&
    /^[A-Za-z0-9][A-Za-z0-9/_.-]*$/u.test(value) &&
    !value.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
  );
}

export function isSafeExternalMediaUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      value.length <= 2_048
    );
  } catch {
    return false;
  }
}
