import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { UPLOAD_POLICY, inspectUpload, inspectUploadBatch } from "@/server/modules/media";

const ascii = (value: string) => new TextEncoder().encode(value);
const blob = (bytes: Uint8Array, type: string) => new Blob([Uint8Array.from(bytes)], { type });
const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0xff, 0xd9]);
const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
const webp = Uint8Array.from([...ascii("RIFF"), 4, 0, 0, 0, ...ascii("WEBP")]);
const avif = Uint8Array.from([0, 0, 0, 16, ...ascii("ftypavif"), 0, 0, 0, 0]);
const mp4 = Uint8Array.from([0, 0, 0, 16, ...ascii("ftypisom"), 0, 0, 0, 0]);
const webm = Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3, 0x42, 0x82, 0x84, ...ascii("webm")]);
const pdf = ascii("%PDF-1.7\n1 0 obj\n%%EOF\n");
const quota = { adminRollingDayBytes: 0, activeStorageBytes: 0 };

describe("media upload policy", () => {
  it.each([
    ["meal.jpg", jpeg, "image/jpeg", "image"],
    ["meal.jpeg", jpeg, "image/jpeg", "image"],
    ["meal.png", png, "image/png", "image"],
    ["meal.webp", webp, "image/webp", "image"],
    ["meal.avif", avif, "image/avif", "image"],
    ["meal.mp4", mp4, "video/mp4", "video"],
    ["meal.webm", webm, "video/webm", "video"],
    ["menu.pdf", pdf, "application/pdf", "pdf"],
  ] as const)("accepts %s with matching MIME and signature", async (name, data, type, kind) => {
    await expect(inspectUpload({ name, blob: blob(data, type) })).resolves.toMatchObject({
      name,
      mimeType: type,
      kind,
      bytes: data.length,
    });
  });

  it.each([
    ["meal.php.jpg", jpeg, "image/jpeg", "invalid_name"],
    ["meal.jpg.exe", jpeg, "image/jpeg", "invalid_name"],
    ["../meal.jpg", jpeg, "image/jpeg", "invalid_name"],
    ["meal%00.jpg", jpeg, "image/jpeg", "invalid_name"],
    ["meal\u202Ejpg.png", png, "image/png", "invalid_name"],
    ["meal.svg", ascii("<svg></svg>"), "image/svg+xml", "unsupported_type"],
    ["meal.jpg", pdf, "image/jpeg", "invalid_signature"],
    ["meal.jpg", jpeg, "application/pdf", "type_mismatch"],
    ["meal.pdf", ascii("%PDF-1.7\nwithout trailer"), "application/pdf", "invalid_signature"],
    ["meal.webp", ascii("RIFFxxxxNOTW"), "image/webp", "invalid_signature"],
    ["meal.mp4", avif, "video/mp4", "invalid_signature"],
    ["meal.jpg", new Uint8Array(), "image/jpeg", "empty_file"],
  ] as const)("rejects unsafe fixture %s (%s)", async (name, data, type, code) => {
    await expect(inspectUpload({ name, blob: blob(data, type) })).rejects.toMatchObject({ code });
  });

  it("enforces actual Blob size rather than trusting a declared byte count", async () => {
    const oversized = new Blob([jpeg, new Uint8Array(UPLOAD_POLICY.formats.jpg.maxBytes)], {
      type: "image/jpeg",
    });
    await expect(inspectUpload({ name: "meal.jpg", blob: oversized })).rejects.toMatchObject({
      code: "file_too_large",
    });
  });

  it("enforces request count, aggregate size, and fail-closed quotas", async () => {
    const file = { name: "meal.jpg", blob: blob(jpeg, "image/jpeg") };
    await expect(inspectUploadBatch([], quota)).rejects.toMatchObject({ code: "too_many_files" });
    await expect(inspectUploadBatch(Array(11).fill(file), quota)).rejects.toMatchObject({
      code: "too_many_files",
    });
    await expect(inspectUploadBatch([file], null)).rejects.toMatchObject({
      code: "quota_unavailable",
    });
    await expect(
      inspectUploadBatch([file], {
        ...quota,
        adminRollingDayBytes: UPLOAD_POLICY.maxAdminBytesPerRollingDay,
      }),
    ).rejects.toMatchObject({ code: "admin_quota_exceeded" });
    await expect(
      inspectUploadBatch([file], {
        ...quota,
        activeStorageBytes: UPLOAD_POLICY.maxActiveStorageBytes,
      }),
    ).rejects.toMatchObject({ code: "storage_quota_exceeded" });
    await expect(inspectUploadBatch([file], quota)).resolves.toHaveLength(1);
  });

  it("rejects an oversized multi-file request before examining content", async () => {
    const large = new Blob([new Uint8Array(41 * 1024 * 1024)], { type: "video/mp4" });
    await expect(
      inspectUploadBatch(
        [
          { name: "a.mp4", blob: large },
          { name: "b.mp4", blob: large },
        ],
        quota,
      ),
    ).rejects.toMatchObject({ code: "request_too_large" });
  });
});
