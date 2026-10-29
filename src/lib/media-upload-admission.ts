import { normalizeMediaFilename } from "./media-filename";

export const MEDIA_UPLOAD_MAX_BYTES = 3 * 1024 * 1024;
export const MEDIA_UPLOAD_MAX_FILES = 10;

const formats = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
} as const;

export type MediaUploadAdmissionError =
  "empty_file" | "file_too_large" | "invalid_name" | "type_mismatch" | "unsupported_type";

/** Fast browser checks; the Route Handler remains authoritative for bytes and signatures. */
export function mediaUploadAdmission(file: File): MediaUploadAdmissionError | null {
  const name = normalizeMediaFilename(file.name, file.type);
  const extension = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
  if (!(extension in formats)) return "unsupported_type";
  if (file.size === 0) return "empty_file";
  if (file.size > MEDIA_UPLOAD_MAX_BYTES) return "file_too_large";
  if (file.type.toLowerCase() !== formats[extension as keyof typeof formats]) {
    return "type_mismatch";
  }
  return null;
}

export function mediaUploadFingerprint(file: File): string {
  return `${file.name.normalize("NFC")}\u0000${file.size}\u0000${file.lastModified}`;
}
