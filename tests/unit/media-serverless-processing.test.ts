import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  INLINE_PROCESSING_POLICY,
  planMediaProcessing,
  processImage,
  processImageForRoute,
} from "@/server/modules/media";

const png = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: "#ef7580" } })
    .png()
    .toBuffer();

describe("serverless media processing boundary", () => {
  it("leaves headroom below Vercel body and function time limits", () => {
    expect(INLINE_PROCESSING_POLICY.maxRouteBodyBytes).toBeLessThan(4.5 * 1024 * 1024);
    expect(INLINE_PROCESSING_POLICY.maxRequestImageBytes).toBeLessThan(
      INLINE_PROCESSING_POLICY.maxRouteBodyBytes,
    );
    expect(INLINE_PROCESSING_POLICY.processingBudgetMs).toBeLessThan(
      INLINE_PROCESSING_POLICY.routeMaxDurationSeconds * 1000,
    );
    expect(INLINE_PROCESSING_POLICY.maxFilesPerRequest).toBe(1);
    expect(INLINE_PROCESSING_POLICY.maxConcurrentJobsPerInstance).toBe(1);
  });

  it("admits one bounded image and rejects oversized or non-image work", () => {
    expect(
      planMediaProcessing({ kind: "image", bytes: 100_000, width: 1200, height: 800 }),
    ).toEqual({ mode: "inline_image" });
    expect(
      planMediaProcessing({
        kind: "image",
        bytes: INLINE_PROCESSING_POLICY.maxRequestImageBytes + 1,
        width: 100,
        height: 100,
      }),
    ).toMatchObject({ mode: "unsupported_mvp", reason: "size" });
    expect(planMediaProcessing({ kind: "image", bytes: 10, width: 4001, height: 2 })).toMatchObject(
      { mode: "unsupported_mvp", reason: "dimensions" },
    );
    expect(
      planMediaProcessing({ kind: "image", bytes: 10, width: 3000, height: 3000 }),
    ).toMatchObject({ mode: "unsupported_mvp", reason: "dimensions" });
    expect(planMediaProcessing({ kind: "image", bytes: 0, width: 10, height: 10 })).toMatchObject({
      mode: "unsupported_mvp",
      reason: "invalid_measurements",
    });
    for (const kind of ["video", "pdf", "other"] as const) {
      expect(planMediaProcessing({ kind, bytes: 100 })).toMatchObject({
        mode: "unsupported_mvp",
        reason: "non_image",
      });
    }
  });

  it("enforces actual buffer size and decoded dimensions before route processing", async () => {
    await expect(
      processImageForRoute(
        Buffer.alloc(INLINE_PROCESSING_POLICY.maxRequestImageBytes + 1),
        "image/png",
      ),
    ).rejects.toMatchObject({ code: "requires_background_processing" });
    await expect(processImageForRoute(await png(4001, 2), "image/png")).rejects.toMatchObject({
      code: "requires_background_processing",
    });
    await expect(processImageForRoute(await png(3000, 3000), "image/png")).rejects.toMatchObject({
      code: "requires_background_processing",
    });
    const processed = await processImageForRoute(await png(200, 100), "image/png");
    expect(processed.variants[0]?.role).toBe("display_webp");
  });

  it("rejects concurrent work on the same warm function instance", async () => {
    const input = await png(500, 500);
    const results = await Promise.allSettled([
      processImageForRoute(input, "image/png"),
      processImageForRoute(input, "image/png"),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toMatchObject([
      { reason: { code: "processing_busy" } },
    ]);
  });

  it("enforces a processing deadline and bounded variant timeout configuration", async () => {
    const input = await png(20, 20);
    await expect(
      processImage(input, "image/png", { deadlineAtMs: Date.now() - 1 }),
    ).rejects.toMatchObject({ code: "processing_timeout" });
    await expect(
      processImage(input, "image/png", { variantTimeoutSeconds: 0 }),
    ).rejects.toMatchObject({ code: "invalid_image" });
  });
});
