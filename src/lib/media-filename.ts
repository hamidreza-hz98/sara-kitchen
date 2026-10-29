const extensionsByMime: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "application/pdf": "pdf",
};

/** Produce a safe display name; content validation remains authoritative. */
export function normalizeMediaFilename(name: string, mimeType: string): string {
  const extension = extensionsByMime[mimeType.toLowerCase()];
  if (!extension) return "upload.unsupported";
  const base = name.normalize("NFC").split(/[\\/]/u).pop() ?? "";
  const stem = base
    .replace(/\.[^.]*$/u, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
  let safe = "";
  for (const character of stem) {
    if (new TextEncoder().encode(safe + character).length > 160) break;
    safe += character;
  }
  return `${safe.replace(/-+$/u, "") || "upload"}.${extension}`;
}
