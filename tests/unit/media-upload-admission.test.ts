import { describe, expect, it } from "vitest";

import {
  MEDIA_UPLOAD_MAX_BYTES,
  mediaUploadAdmission,
  mediaUploadFingerprint,
} from "@/lib/media-upload-admission";

function file(name: string, type = "image/png", size = 1): File {
  return new File([new Uint8Array(size)], name, { type, lastModified: 100 });
}

describe("media upload browser admission", () => {
  it("accepts supported images and detects mismatched MIME types", () => {
    expect(mediaUploadAdmission(file("sara-kitchen.png"))).toBeNull();
    expect(mediaUploadAdmission(file("sara-kitchen.jpg", "image/png"))).toBe("type_mismatch");
  });

  it("rejects empty, oversized, unsupported, and double-extension files", () => {
    expect(mediaUploadAdmission(file("empty.png", "image/png", 0))).toBe("empty_file");
    expect(mediaUploadAdmission(file("huge.png", "image/png", MEDIA_UPLOAD_MAX_BYTES + 1))).toBe(
      "file_too_large",
    );
    expect(mediaUploadAdmission(file("video.mp4", "video/mp4"))).toBe("unsupported_type");
    expect(mediaUploadAdmission(file("invoice.pdf.png"))).toBe("invalid_name");
  });

  it("uses stable selection fingerprints", () => {
    expect(mediaUploadFingerprint(file("one.png"))).toBe(mediaUploadFingerprint(file("one.png")));
    expect(mediaUploadFingerprint(file("one.png"))).not.toBe(
      mediaUploadFingerprint(file("two.png")),
    );
  });
});
