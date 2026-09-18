import { describe, expect, it } from "vitest";

import type { StorageObjectRef, StorageProvider } from "@/server/modules/media";

const bytes = (value: string) => new TextEncoder().encode(value);
const stream = (value: Uint8Array) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(value);
      controller.close();
    },
  });

async function consume(body: ReadableStream<Uint8Array>): Promise<string> {
  const chunks: Uint8Array[] = [];
  const reader = body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

/** Reuse this suite for the fake and future MinIO adapter. */
export function storageProviderContract(name: string, createProvider: () => StorageProvider): void {
  const original: StorageObjectRef = { bucket: "private-media", key: "originals/test.txt" };
  const copied: StorageObjectRef = { bucket: "private-media", key: "variants/test.txt" };
  const moved: StorageObjectRef = { bucket: "private-media", key: "variants/moved.txt" };

  describe(`${name} storage-provider contract`, () => {
    it("uploads, stats, and streams complete and ranged objects", async () => {
      const provider = createProvider();
      const content = bytes("Persian food");
      await expect(
        provider.upload({
          ...original,
          contentLength: content.length,
          contentType: "text/plain",
          body: stream(content),
        }),
      ).resolves.toMatchObject({ ...original, bytes: content.length, contentType: "text/plain" });
      await expect(provider.stat(original)).resolves.toMatchObject({ bytes: content.length });
      const whole = await provider.read(original);
      expect(whole.bytes).toBe(content.length);
      expect(whole.totalBytes).toBe(content.length);
      expect(await consume(whole.body)).toBe("Persian food");
      const range = await provider.read(original, { start: 2, end: 6 });
      expect(range.bytes).toBe(5);
      expect(range.totalBytes).toBe(content.length);
      expect(await consume(range.body)).toBe("rsian");
    });

    it("rejects overwrite, length mismatch, and invalid ranges", async () => {
      const provider = createProvider();
      const input = { ...original, contentLength: 3, contentType: "text/plain" };
      await expect(
        provider.upload({ ...input, body: stream(bytes("abc")) }),
      ).resolves.toBeDefined();
      await expect(provider.upload({ ...input, body: stream(bytes("xyz")) })).rejects.toMatchObject(
        { code: "already_exists" },
      );
      await expect(
        provider.upload({
          ...copied,
          contentLength: 4,
          contentType: "text/plain",
          body: stream(bytes("a")),
        }),
      ).rejects.toMatchObject({ code: "length_mismatch" });
      await expect(provider.stat(copied)).resolves.toBeNull();
      await expect(provider.read(original, { end: 1 })).rejects.toMatchObject({
        code: "invalid_input",
      });
      await expect(provider.read(original, { start: 2, end: 9 })).rejects.toMatchObject({
        code: "invalid_input",
      });
    });

    it("copies and moves without overwriting, then deletes idempotently", async () => {
      const provider = createProvider();
      await provider.upload({
        ...original,
        contentLength: 3,
        contentType: "text/plain",
        body: stream(bytes("abc")),
      });
      await expect(provider.copy(original, copied)).resolves.toMatchObject(copied);
      await expect(provider.stat(original)).resolves.not.toBeNull();
      await expect(provider.copy(original, copied)).rejects.toMatchObject({
        code: "already_exists",
      });
      await expect(provider.move(copied, moved)).resolves.toMatchObject(moved);
      await expect(provider.stat(copied)).resolves.toBeNull();
      expect(await consume((await provider.read(moved)).body)).toBe("abc");
      await provider.delete(moved);
      await expect(provider.delete(moved)).resolves.toBeUndefined();
      await expect(provider.read(moved)).rejects.toMatchObject({ code: "not_found" });
    });

    it("issues bounded signed read URLs and reports sanitized health", async () => {
      const provider = createProvider();
      await provider.upload({
        ...original,
        contentLength: 1,
        contentType: "text/plain",
        body: stream(bytes("a")),
      });
      const signed = await provider.signedReadUrl(original, 60);
      expect(["http:", "https:"]).toContain(new URL(signed.url).protocol);
      expect(signed.expiresAt.getTime()).toBeGreaterThan(Date.now());
      await expect(provider.signedReadUrl(original, 901)).rejects.toMatchObject({
        code: "invalid_input",
      });
      await expect(provider.signedReadUrl(copied, 60)).rejects.toMatchObject({ code: "not_found" });
      await expect(provider.health()).resolves.toMatchObject({ healthy: true, reason: "ok" });
    });
  });
}
