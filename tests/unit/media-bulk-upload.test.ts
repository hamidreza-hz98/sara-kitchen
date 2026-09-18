// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import {
  MediaBulkUploadError,
  MediaUploadTransportError,
  uploadMediaBatch,
} from "@/lib/media-bulk-upload";
import type { MediaBulkUploadItem, MediaUploadTransport } from "@/lib/media-bulk-upload";

function item(index: number): MediaBulkUploadItem {
  return {
    clientId: `item-${index}`,
    file: new File([`image-${index}`], `meal-${index}.png`, { type: "image/png" }),
    translations: [{ locale: "en", alt: `Meal ${index}` }],
  };
}

describe("media bulk upload coordinator", () => {
  it("bounds concurrency and returns ordered independent outcomes with an end summary", async () => {
    let active = 0;
    let maximum = 0;
    const release: (() => void)[] = [];
    const progress = vi.fn();
    const transport: MediaUploadTransport = async (entry, context) => {
      active += 1;
      maximum = Math.max(maximum, active);
      context.onProgress(50);
      await new Promise<void>((resolve) => release.push(resolve));
      active -= 1;
      if (entry.clientId === "item-1") {
        throw new MediaUploadTransportError("VALIDATION_ERROR", false);
      }
      return { id: `media-${entry.clientId}`, checksum: "a".repeat(64), variantCount: 4 };
    };
    const pending = uploadMediaBatch([item(0), item(1), item(2)], {
      concurrency: 2,
      csrfToken: "csrf",
      transport,
      onProgress: progress,
    });
    await vi.waitFor(() => expect(release).toHaveLength(2));
    release.splice(0).forEach((resolve) => resolve());
    await vi.waitFor(() => expect(release).toHaveLength(1));
    release.shift()?.();
    const report = await pending;

    expect(maximum).toBe(2);
    expect(report.items.map((result) => result.clientId)).toEqual(["item-0", "item-1", "item-2"]);
    expect(report.items.map((result) => result.status)).toEqual([
      "succeeded",
      "failed",
      "succeeded",
    ]);
    expect(report.summary).toEqual({ total: 3, succeeded: 2, failed: 1, retried: 0 });
    expect(progress).toHaveBeenCalledWith(
      expect.objectContaining({ stage: "queued", progress: 0 }),
    );
    expect(progress).toHaveBeenCalledWith(
      expect.objectContaining({ stage: "uploading", progress: 50 }),
    );
    expect(progress).toHaveBeenCalledWith(
      expect.objectContaining({ stage: "failed", progress: 100 }),
    );
  });

  it("retries transient failures but not permanent failures", async () => {
    const attempts = new Map<string, number>();
    const delays: number[] = [];
    const transport: MediaUploadTransport = async (entry) => {
      const attempt = (attempts.get(entry.clientId) ?? 0) + 1;
      attempts.set(entry.clientId, attempt);
      if (entry.clientId === "item-0" && attempt < 3) {
        throw new MediaUploadTransportError("SERVICE_UNAVAILABLE", true);
      }
      if (entry.clientId === "item-1") {
        throw new MediaUploadTransportError("VALIDATION_ERROR", false);
      }
      return { id: "media", checksum: "b".repeat(64), variantCount: 4 };
    };
    const report = await uploadMediaBatch([item(0), item(1)], {
      concurrency: 1,
      csrfToken: "csrf",
      transport,
      sleep: async (delay) => {
        delays.push(delay);
      },
    });

    expect(attempts).toEqual(
      new Map([
        ["item-0", 3],
        ["item-1", 1],
      ]),
    );
    expect(delays).toEqual([250, 500]);
    expect(report.items[0]).toMatchObject({ status: "succeeded", attempts: 3 });
    expect(report.items[1]).toMatchObject({ status: "failed", attempts: 1 });
    expect(report.summary).toEqual({ total: 2, succeeded: 1, failed: 1, retried: 1 });
  });

  it("allows callers to disable transient retries", async () => {
    const transport = vi
      .fn<MediaUploadTransport>()
      .mockRejectedValue(new MediaUploadTransportError("SERVICE_UNAVAILABLE", true));
    const report = await uploadMediaBatch([item(0)], {
      csrfToken: "csrf",
      maxRetries: 0,
      transport,
    });
    expect(transport).toHaveBeenCalledOnce();
    expect(report.items[0]).toMatchObject({ status: "failed", attempts: 1 });
  });

  it("rejects invalid batch envelopes before starting network work", async () => {
    const transport = vi.fn<MediaUploadTransport>();
    await expect(uploadMediaBatch([], { csrfToken: "csrf", transport })).rejects.toBeInstanceOf(
      MediaBulkUploadError,
    );
    await expect(
      uploadMediaBatch([item(0), { ...item(1), clientId: "item-0" }], {
        csrfToken: "csrf",
        transport,
      }),
    ).rejects.toMatchObject({ code: "duplicate_client_id" });
    expect(transport).not.toHaveBeenCalled();
  });

  it("marks queued work aborted without rejecting the batch", async () => {
    const controller = new AbortController();
    controller.abort();
    const transport = vi.fn<MediaUploadTransport>();
    const report = await uploadMediaBatch([item(0), item(1)], {
      csrfToken: "csrf",
      signal: controller.signal,
      transport,
    });
    expect(report.items.every((result) => result.error?.code === "aborted")).toBe(true);
    expect(report.summary).toEqual({ total: 2, succeeded: 0, failed: 2, retried: 0 });
    expect(transport).not.toHaveBeenCalled();
  });
});
