import { createHash } from "node:crypto";

import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { IMAGE_PROCESSING_POLICY, processImage } from "@/server/modules/media";

async function solid(width: number, height: number, channels: 3 | 4 = 3): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels,
      background: channels === 4 ? { r: 220, g: 80, b: 40, alpha: 0.4 } : { r: 220, g: 80, b: 40 },
    },
  })
    .png()
    .toBuffer();
}

describe("media image processing", () => {
  it("emits four ordered, decodable variants with deterministic metadata", async () => {
    const input = await solid(2400, 1200);
    const result = await processImage(input, "image/png");
    expect(result.source).toEqual({
      width: 2400,
      height: 1200,
      bytes: input.length,
      mimeType: "image/png",
    });
    expect(result.hasAlpha).toBe(false);
    expect(result.variants.map((variant) => variant.role)).toEqual([
      "display_webp",
      "display_fallback",
      "thumbnail_webp",
      "thumbnail_fallback",
    ]);
    expect(result.variants.map((variant) => [variant.width, variant.height])).toEqual([
      [1600, 800],
      [1600, 800],
      [320, 160],
      [320, 160],
    ]);
    expect(result.variants.map((variant) => variant.mimeType)).toEqual([
      "image/webp",
      "image/jpeg",
      "image/webp",
      "image/jpeg",
    ]);
    for (const variant of result.variants) {
      const metadata = await sharp(variant.data).metadata();
      expect([metadata.width, metadata.height]).toEqual([variant.width, variant.height]);
      expect(metadata.exif).toBeUndefined();
      expect(metadata.xmp).toBeUndefined();
      expect(variant.bytes).toBe(variant.data.length);
      expect(variant.checksum).toBe(createHash("sha256").update(variant.data).digest("hex"));
    }
    const again = await processImage(input, "image/png");
    expect(again.variants.map((variant) => variant.checksum)).toEqual(
      result.variants.map((variant) => variant.checksum),
    );
  });

  it("corrects EXIF orientation and does not carry EXIF into outputs", async () => {
    const input = await sharp({ create: { width: 80, height: 40, channels: 3, background: "red" } })
      .jpeg()
      .withMetadata({ orientation: 6, exif: { IFD0: { Artist: "private photographer" } } })
      .toBuffer();
    const source = await sharp(input).metadata();
    expect(source.orientation).toBe(6);
    const output = await processImage(input, "image/jpeg");
    for (const variant of output.variants) {
      expect([variant.width, variant.height]).toEqual([40, 80]);
      const metadata = await sharp(variant.data).metadata();
      expect(metadata.exif).toBeUndefined();
      expect(metadata.orientation).toBeUndefined();
    }
  });

  it("retains transparency in WebP and PNG fallbacks without enlarging small images", async () => {
    const input = await solid(64, 48, 4);
    const output = await processImage(input, "image/png");
    expect(output.hasAlpha).toBe(true);
    expect(output.variants.every((variant) => variant.width === 64 && variant.height === 48)).toBe(
      true,
    );
    expect(output.variants.map((variant) => variant.mimeType)).toEqual([
      "image/webp",
      "image/png",
      "image/webp",
      "image/png",
    ]);
    for (const variant of output.variants) {
      const metadata = await sharp(variant.data).metadata();
      expect(metadata.hasAlpha).toBe(true);
      const { data } = await sharp(variant.data)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      expect(data[3]).toBeGreaterThan(0);
      expect(data[3]).toBeLessThan(255);
    }
  });

  it.each([
    ["image/webp", "webp"],
    ["image/avif", "avif"],
  ] as const)("processes an admitted %s source", async (mimeType, format) => {
    const png = await solid(96, 64);
    const input = await sharp(png).toFormat(format).toBuffer();
    const output = await processImage(input, mimeType);
    expect(output.variants).toHaveLength(4);
    expect(output.variants[0]).toMatchObject({ width: 96, height: 64, mimeType: "image/webp" });
  });

  it("substantially compresses a photographic-style PNG fixture", async () => {
    const width = 1200;
    const height = 800;
    const pixels = Buffer.alloc(width * height * 3);
    for (let index = 0; index < pixels.length; index += 1)
      pixels[index] = (index * 73 + (index >> 9) * 19) & 255;
    const input = await sharp(pixels, { raw: { width, height, channels: 3 } })
      .png({ compressionLevel: 0 })
      .toBuffer();
    const output = await processImage(input, "image/png");
    expect(output.variants[0]?.bytes).toBeLessThan(input.length / 2);
    expect(output.variants[2]?.bytes).toBeLessThan(output.variants[0]?.bytes ?? 0);
  });

  it("rejects malformed, mismatched, oversized, and decompression-bomb dimensions", async () => {
    const png = await solid(10, 10);
    await expect(processImage(Buffer.alloc(0), "image/png")).rejects.toMatchObject({
      code: "invalid_image",
    });
    await expect(processImage(Buffer.from("<svg/>"), "image/png")).rejects.toMatchObject({
      code: "invalid_image",
    });
    await expect(processImage(png, "image/jpeg")).rejects.toMatchObject({
      code: "unsupported_format",
    });
    await expect(
      processImage(Buffer.alloc(IMAGE_PROCESSING_POLICY.maxInputBytes + 1), "image/png"),
    ).rejects.toMatchObject({ code: "image_too_large" });
    const wide = await solid(8001, 2);
    await expect(processImage(wide, "image/png")).rejects.toMatchObject({
      code: "dimension_limit",
    });
    const huge = await solid(7000, 5000);
    await expect(processImage(huge, "image/png")).rejects.toMatchObject({ code: "pixel_limit" });
  });
});
