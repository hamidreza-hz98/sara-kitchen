import type { MediaKind } from "./media-metadata";

const MiB = 1024 * 1024;

export const UPLOAD_POLICY = {
  bucketAccess: "private",
  maxFilesPerRequest: 10,
  maxRequestBytes: 80 * MiB,
  maxOriginalNameBytes: 180,
  maxAdminBytesPerRollingDay: 1024 * MiB,
  maxActiveStorageBytes: 10 * 1024 * MiB,
  formats: {
    jpg: { mimeType: "image/jpeg", kind: "image", maxBytes: 10 * MiB },
    jpeg: { mimeType: "image/jpeg", kind: "image", maxBytes: 10 * MiB },
    png: { mimeType: "image/png", kind: "image", maxBytes: 10 * MiB },
    webp: { mimeType: "image/webp", kind: "image", maxBytes: 10 * MiB },
    avif: { mimeType: "image/avif", kind: "image", maxBytes: 10 * MiB },
    mp4: { mimeType: "video/mp4", kind: "video", maxBytes: 50 * MiB },
    webm: { mimeType: "video/webm", kind: "video", maxBytes: 50 * MiB },
    pdf: { mimeType: "application/pdf", kind: "pdf", maxBytes: 15 * MiB },
  },
} as const;

export type UploadExtension = keyof typeof UPLOAD_POLICY.formats;
export type UploadPolicyCode =
  | "invalid_name"
  | "unsupported_type"
  | "type_mismatch"
  | "invalid_signature"
  | "file_too_large"
  | "empty_file"
  | "too_many_files"
  | "request_too_large"
  | "quota_unavailable"
  | "admin_quota_exceeded"
  | "storage_quota_exceeded";

export class UploadPolicyError extends Error {
  constructor(readonly code: UploadPolicyCode) {
    super(code);
    this.name = "UploadPolicyError";
  }
}

export interface UploadCandidate {
  readonly name: string;
  readonly blob: Blob;
}

export interface UploadQuotaSnapshot {
  /** Includes in-flight reservations. Supplied atomically by the future upload service. */
  readonly adminRollingDayBytes: number;
  /** Includes originals, variants, and in-flight reservations. */
  readonly activeStorageBytes: number;
}

export interface InspectedUpload {
  readonly name: string;
  readonly extension: UploadExtension;
  readonly mimeType: string;
  readonly kind: MediaKind;
  readonly bytes: number;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder("ascii");
const startsWith = (data: Uint8Array, bytes: number[]): boolean =>
  bytes.every((byte, index) => data[index] === byte);
const ascii = (data: Uint8Array, start: number, end: number): string =>
  decoder.decode(data.slice(start, end));

function hasFtypBrand(head: Uint8Array, brands: readonly string[]): boolean {
  if (head.length < 16 || ascii(head, 4, 8) !== "ftyp") return false;
  const boxLength = new DataView(head.buffer, head.byteOffset, head.byteLength).getUint32(0);
  if (boxLength < 16 || boxLength > head.length || (boxLength - 16) % 4 !== 0) return false;
  for (let offset = 8; offset < boxLength; offset += offset === 8 ? 8 : 4) {
    if (brands.includes(ascii(head, offset, offset + 4))) return true;
  }
  return false;
}

function hasSignature(extension: UploadExtension, head: Uint8Array, tail: Uint8Array): boolean {
  switch (extension) {
    case "jpg":
    case "jpeg":
      return startsWith(head, [0xff, 0xd8, 0xff]) && tail.at(-2) === 0xff && tail.at(-1) === 0xd9;
    case "png":
      return startsWith(head, [137, 80, 78, 71, 13, 10, 26, 10]);
    case "webp":
      return ascii(head, 0, 4) === "RIFF" && ascii(head, 8, 12) === "WEBP";
    case "avif":
      return hasFtypBrand(head, ["avif", "avis"]);
    case "mp4":
      return hasFtypBrand(head, ["isom", "iso2", "mp41", "mp42", "avc1", "M4V "]);
    case "webm":
      return (
        startsWith(head, [0x1a, 0x45, 0xdf, 0xa3]) &&
        head.some(
          (byte, index) =>
            byte === 0x42 &&
            head[index + 1] === 0x82 &&
            head[index + 2] === 0x84 &&
            ascii(head, index + 3, index + 7) === "webm",
        )
      );
    case "pdf":
      return (
        /^%PDF-(?:1\.[0-7]|2\.0)(?:\r|\n)/u.test(ascii(head, 0, 12)) &&
        ascii(tail, 0, tail.length).includes("%%EOF")
      );
  }
}

function extensionOf(name: string): UploadExtension {
  const normalized = name.normalize("NFC");
  const bytes = encoder.encode(normalized).length;
  if (
    bytes === 0 ||
    bytes > UPLOAD_POLICY.maxOriginalNameBytes ||
    normalized !== name ||
    !/^[\p{L}\p{N}][\p{L}\p{N} _-]*\.[a-zA-Z0-9]+$/u.test(name)
  ) {
    throw new UploadPolicyError("invalid_name");
  }
  const extension = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
  if (!(extension in UPLOAD_POLICY.formats)) throw new UploadPolicyError("unsupported_type");
  return extension as UploadExtension;
}

export async function inspectUpload(candidate: UploadCandidate): Promise<InspectedUpload> {
  const extension = extensionOf(candidate.name);
  const format = UPLOAD_POLICY.formats[extension];
  const bytes = candidate.blob.size;
  if (bytes === 0) throw new UploadPolicyError("empty_file");
  if (bytes > format.maxBytes) throw new UploadPolicyError("file_too_large");
  if (candidate.blob.type.toLowerCase() !== format.mimeType) {
    throw new UploadPolicyError("type_mismatch");
  }
  const [head, tail] = await Promise.all([
    candidate.blob.slice(0, 4096).arrayBuffer(),
    candidate.blob.slice(Math.max(0, bytes - 1024)).arrayBuffer(),
  ]);
  if (!hasSignature(extension, new Uint8Array(head), new Uint8Array(tail))) {
    throw new UploadPolicyError("invalid_signature");
  }
  return { name: candidate.name, extension, mimeType: format.mimeType, kind: format.kind, bytes };
}

export async function inspectUploadBatch(
  candidates: readonly UploadCandidate[],
  quota: UploadQuotaSnapshot | null,
): Promise<readonly InspectedUpload[]> {
  if (candidates.length === 0 || candidates.length > UPLOAD_POLICY.maxFilesPerRequest) {
    throw new UploadPolicyError("too_many_files");
  }
  const requestBytes = candidates.reduce((total, candidate) => total + candidate.blob.size, 0);
  if (requestBytes > UPLOAD_POLICY.maxRequestBytes)
    throw new UploadPolicyError("request_too_large");
  if (
    !quota ||
    !Number.isSafeInteger(quota.adminRollingDayBytes) ||
    !Number.isSafeInteger(quota.activeStorageBytes) ||
    quota.adminRollingDayBytes < 0 ||
    quota.activeStorageBytes < 0
  ) {
    throw new UploadPolicyError("quota_unavailable");
  }
  if (quota.adminRollingDayBytes + requestBytes > UPLOAD_POLICY.maxAdminBytesPerRollingDay) {
    throw new UploadPolicyError("admin_quota_exceeded");
  }
  if (quota.activeStorageBytes + requestBytes > UPLOAD_POLICY.maxActiveStorageBytes) {
    throw new UploadPolicyError("storage_quota_exceeded");
  }
  return Promise.all(candidates.map(inspectUpload));
}
