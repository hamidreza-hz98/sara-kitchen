import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { selectStorefrontVariant } from "@/server/modules/media/service/seo-image";
import type { MediaVariant } from "@/server/modules/media/model/media";

function variant(
  key: string,
  mimeType: string,
  width: number,
  processingState: MediaVariant["processingState"] = "ready",
): MediaVariant {
  return {
    key,
    mimeType,
    bytes: 100,
    dimensions: { width, height: width },
    checksum: "a".repeat(64),
    processingState,
    failureCode: null,
  };
}

describe("homepage media variants", () => {
  const variants = [
    variant("large-fallback", "image/jpeg", 1200),
    variant("small-webp", "image/webp", 320),
    variant("large-webp", "image/webp", 1200),
    variant("failed-webp", "image/webp", 64, "failed"),
  ];

  it("uses the small ready WebP thumbnail for cards", () => {
    expect(selectStorefrontVariant(variants, "thumbnail")?.key).toBe("small-webp");
  });

  it("uses the large ready WebP for the hero", () => {
    expect(selectStorefrontVariant(variants, "display")?.key).toBe("large-webp");
  });

  it("falls back to a safe format when WebP is unavailable", () => {
    expect(
      selectStorefrontVariant(
        variants.filter((item) => item.mimeType !== "image/webp"),
        "thumbnail",
      )?.key,
    ).toBe("large-fallback");
  });
});
