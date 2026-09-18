import "server-only";

import { createHash } from "node:crypto";

import sharp from "sharp";

const MiB = 1024 * 1024;

export const IMAGE_PROCESSING_POLICY = {
  maxInputBytes: 10 * MiB,
  maxInputPixels: 32_000_000,
  maxInputSide: 8_000,
  displaySide: 1_600,
  thumbnailSide: 320,
  webpQuality: 78,
  jpegQuality: 82,
} as const;

export type ImageMimeType = "image/jpeg" | "image/png" | "image/webp" | "image/avif";
export type ImageVariantRole =
  "display_webp" | "display_fallback" | "thumbnail_webp" | "thumbnail_fallback";
export type ImageProcessingErrorCode =
  | "unsupported_format"
  | "invalid_image"
  | "image_too_large"
  | "pixel_limit"
  | "dimension_limit"
  | "decode_failed"
  | "processing_timeout"
  | "processing_busy"
  | "requires_background_processing";

export class ImageProcessingError extends Error {
  constructor(readonly code: ImageProcessingErrorCode) {
    super(code);
    this.name = "ImageProcessingError";
  }
}

export interface ImageVariantOutput {
  readonly role: ImageVariantRole;
  readonly extension: "webp" | "jpg" | "png";
  readonly mimeType: "image/webp" | "image/jpeg" | "image/png";
  readonly bytes: number;
  readonly width: number;
  readonly height: number;
  readonly checksum: string;
  readonly data: Buffer;
}

export interface ProcessedImage {
  readonly source: { width: number; height: number; bytes: number; mimeType: ImageMimeType };
  readonly hasAlpha: boolean;
  readonly variants: readonly ImageVariantOutput[];
}

export interface ImageProcessingOptions {
  /** Absolute epoch deadline, leaving route time for storage and response. */
  readonly deadlineAtMs?: number;
  /** Native libvips timeout for each sequential variant. */
  readonly variantTimeoutSeconds?: number;
}

const supportedFormats: Record<ImageMimeType, string> = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "heif",
};

function decoder(input: Buffer) {
  return sharp(input, {
    failOn: "warning",
    limitInputPixels: IMAGE_PROCESSING_POLICY.maxInputPixels,
    animated: false,
  });
}

async function renderVariant(
  input: Buffer,
  role: ImageVariantRole,
  side: number,
  format: "webp" | "jpeg" | "png",
  timeoutSeconds: number,
): Promise<ImageVariantOutput> {
  let pipeline = decoder(input)
    .autoOrient()
    .resize({ width: side, height: side, fit: "inside", withoutEnlargement: true })
    .timeout({ seconds: timeoutSeconds });

  if (format === "webp") {
    pipeline = pipeline.webp({ quality: IMAGE_PROCESSING_POLICY.webpQuality, effort: 5 });
  } else if (format === "jpeg") {
    pipeline = pipeline.jpeg({ quality: IMAGE_PROCESSING_POLICY.jpegQuality, mozjpeg: true });
  } else {
    pipeline = pipeline.png({ compressionLevel: 9, palette: false });
  }

  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  const extension = format === "jpeg" ? "jpg" : format;
  const mimeType: ImageVariantOutput["mimeType"] =
    format === "jpeg" ? "image/jpeg" : format === "png" ? "image/png" : "image/webp";
  return {
    role,
    extension,
    mimeType,
    bytes: data.length,
    width: info.width,
    height: info.height,
    checksum: createHash("sha256").update(data).digest("hex"),
    data,
  };
}

/** Decode an admitted image and produce metadata-free public display variants. */
export async function processImage(
  input: Buffer,
  mimeType: ImageMimeType,
  options: ImageProcessingOptions = {},
): Promise<ProcessedImage> {
  const deadlineAtMs = options.deadlineAtMs ?? Number.POSITIVE_INFINITY;
  const variantTimeoutSeconds = options.variantTimeoutSeconds ?? 5;
  if (
    (deadlineAtMs !== Number.POSITIVE_INFINITY && !Number.isFinite(deadlineAtMs)) ||
    !Number.isInteger(variantTimeoutSeconds) ||
    variantTimeoutSeconds < 1 ||
    variantTimeoutSeconds > 10
  ) {
    throw new ImageProcessingError("invalid_image");
  }
  if (Date.now() >= deadlineAtMs) throw new ImageProcessingError("processing_timeout");
  if (!(mimeType in supportedFormats)) throw new ImageProcessingError("unsupported_format");
  if (input.length === 0) throw new ImageProcessingError("invalid_image");
  if (input.length > IMAGE_PROCESSING_POLICY.maxInputBytes) {
    throw new ImageProcessingError("image_too_large");
  }

  // Header inspection does not decode pixels; enforce our own side/pixel limits
  // before passing the image to the bounded decoder.
  const metadata = await sharp(input, { failOn: "warning", limitInputPixels: false })
    .metadata()
    .catch(() => {
      throw new ImageProcessingError("invalid_image");
    });
  if (
    metadata.format !== supportedFormats[mimeType] ||
    (mimeType === "image/avif" && metadata.compression !== "av1") ||
    !metadata.width ||
    !metadata.height ||
    (metadata.pages ?? 1) !== 1
  ) {
    throw new ImageProcessingError("unsupported_format");
  }
  if (metadata.width * metadata.height > IMAGE_PROCESSING_POLICY.maxInputPixels) {
    throw new ImageProcessingError("pixel_limit");
  }
  if (
    metadata.width > IMAGE_PROCESSING_POLICY.maxInputSide ||
    metadata.height > IMAGE_PROCESSING_POLICY.maxInputSide
  ) {
    throw new ImageProcessingError("dimension_limit");
  }

  const fallback = metadata.hasAlpha ? "png" : "jpeg";
  let variants: ImageVariantOutput[];
  try {
    variants = [];
    for (const [role, side, format] of [
      ["display_webp", IMAGE_PROCESSING_POLICY.displaySide, "webp"],
      ["display_fallback", IMAGE_PROCESSING_POLICY.displaySide, fallback],
      ["thumbnail_webp", IMAGE_PROCESSING_POLICY.thumbnailSide, "webp"],
      ["thumbnail_fallback", IMAGE_PROCESSING_POLICY.thumbnailSide, fallback],
    ] as const) {
      const remainingMs = deadlineAtMs - Date.now();
      if (remainingMs <= 0) throw new ImageProcessingError("processing_timeout");
      const seconds = Math.min(variantTimeoutSeconds, Math.max(1, Math.floor(remainingMs / 1000)));
      variants.push(await renderVariant(input, role, side, format, seconds));
    }
    if (Date.now() >= deadlineAtMs) throw new ImageProcessingError("processing_timeout");
  } catch (error) {
    if (error instanceof ImageProcessingError) throw error;
    if (error instanceof Error && /timeout/iu.test(error.message)) {
      throw new ImageProcessingError("processing_timeout");
    }
    throw new ImageProcessingError("decode_failed");
  }
  return {
    source: { width: metadata.width, height: metadata.height, bytes: input.length, mimeType },
    hasAlpha: metadata.hasAlpha ?? false,
    variants,
  };
}
