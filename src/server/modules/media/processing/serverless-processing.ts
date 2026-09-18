import "server-only";

import sharp from "sharp";

import { ImageProcessingError, processImage } from "./image-processor";
import type { ImageMimeType, ProcessedImage } from "./image-processor";

const MiB = 1024 * 1024;

export const INLINE_PROCESSING_POLICY = {
  maxRequestImageBytes: 3 * MiB,
  maxRouteBodyBytes: Math.floor(3.5 * MiB),
  maxImagePixels: 8_000_000,
  maxImageSide: 4_000,
  maxFilesPerRequest: 1,
  maxConcurrentJobsPerInstance: 1,
  routeMaxDurationSeconds: 15,
  processingBudgetMs: 8_000,
  variantTimeoutSeconds: 2,
} as const;

export type MediaProcessingPlan =
  | { readonly mode: "inline_image" }
  | {
      readonly mode: "unsupported_mvp";
      readonly reason: "non_image" | "size" | "dimensions" | "invalid_measurements";
    };

export function planMediaProcessing(input: {
  readonly kind: "image" | "video" | "pdf" | "other";
  readonly bytes: number;
  readonly width?: number;
  readonly height?: number;
}): MediaProcessingPlan {
  if (input.kind !== "image") return { mode: "unsupported_mvp", reason: "non_image" };
  if (!Number.isSafeInteger(input.bytes) || input.bytes < 1) {
    return { mode: "unsupported_mvp", reason: "invalid_measurements" };
  }
  if (input.bytes > INLINE_PROCESSING_POLICY.maxRequestImageBytes) {
    return { mode: "unsupported_mvp", reason: "size" };
  }
  if (
    !Number.isSafeInteger(input.width) ||
    !Number.isSafeInteger(input.height) ||
    !input.width ||
    !input.height ||
    input.width < 1 ||
    input.height < 1
  ) {
    return { mode: "unsupported_mvp", reason: "invalid_measurements" };
  }
  if (
    input.width > INLINE_PROCESSING_POLICY.maxImageSide ||
    input.height > INLINE_PROCESSING_POLICY.maxImageSide ||
    input.width * input.height > INLINE_PROCESSING_POLICY.maxImagePixels
  ) {
    return { mode: "unsupported_mvp", reason: "dimensions" };
  }
  return { mode: "inline_image" };
}

let activeJobs = 0;

/** The only synchronous processing path approved for Vercel Route Handlers. */
export async function processImageForRoute(
  input: Buffer,
  mimeType: ImageMimeType,
): Promise<ProcessedImage> {
  if (input.length > INLINE_PROCESSING_POLICY.maxRequestImageBytes) {
    throw new ImageProcessingError("requires_background_processing");
  }
  if (activeJobs >= INLINE_PROCESSING_POLICY.maxConcurrentJobsPerInstance) {
    throw new ImageProcessingError("processing_busy");
  }
  activeJobs += 1;
  try {
    const startedAt = Date.now();
    const metadata = await sharp(input, { failOn: "warning", limitInputPixels: false })
      .metadata()
      .catch(() => {
        throw new ImageProcessingError("invalid_image");
      });
    const plan = planMediaProcessing({
      kind: "image",
      bytes: input.length,
      width: metadata.width ?? 0,
      height: metadata.height ?? 0,
    });
    if (plan.mode !== "inline_image") {
      throw new ImageProcessingError("requires_background_processing");
    }
    return await processImage(input, mimeType, {
      deadlineAtMs: startedAt + INLINE_PROCESSING_POLICY.processingBudgetMs,
      variantTimeoutSeconds: INLINE_PROCESSING_POLICY.variantTimeoutSeconds,
    });
  } finally {
    activeJobs -= 1;
  }
}
