import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { MinioStorageProvider, createMediaObjectKey } from "@/server/modules/media";
import type { StorageProvider } from "@/server/modules/media";

import { storageProviderContract } from "../contracts/storage-provider.contract";

function localConfig() {
  const source = readFileSync(resolve("infra/local.env"), "utf8");
  const values = Object.fromEntries(
    source.split(/\r?\n/u).flatMap((line) => {
      const match = /^([A-Z_]+)=(.*)$/u.exec(line.trim());
      return match ? [[match[1], match[2]]] : [];
    }),
  );
  const accessKey = process.env.MINIO_ACCESS_KEY ?? values.MINIO_ROOT_USER;
  const secretKey = process.env.MINIO_SECRET_KEY ?? values.MINIO_ROOT_PASSWORD;
  const bucket = process.env.MINIO_BUCKET ?? values.MINIO_BUCKET;
  if (!accessKey || !secretKey || !bucket)
    throw new Error("Local MinIO test configuration is incomplete.");
  return {
    endpoint: process.env.MINIO_ENDPOINT ?? "127.0.0.1",
    port: Number(process.env.MINIO_PORT ?? 9000),
    useSSL: process.env.MINIO_USE_SSL === "true",
    accessKey,
    secretKey,
    bucket,
    region: process.env.MINIO_REGION ?? values.MINIO_REGION ?? "us-east-1",
  };
}

describe.skipIf(process.env.RUN_MINIO_INTEGRATION !== "1")("MinIO live integration", () => {
  let config: ReturnType<typeof localConfig>;
  let provider: MinioStorageProvider;
  const touched = new Set<string>();

  function testProvider(): MinioStorageProvider {
    return provider;
  }

  // The shared contract uses fixed keys. Each test gets a fresh key prefix, which
  // is cleaned up afterward without changing any preexisting bucket content.
  function isolatedProvider() {
    const base = testProvider();
    const testPrefix = `contract/${crypto.randomUUID()}`;
    const map = (ref: { bucket: string; key: string }) => ({
      bucket: config.bucket,
      key: `${testPrefix}/${ref.key}`,
    });
    const wrap = {
      upload: async (input: Parameters<typeof base.upload>[0]) => {
        const ref = map(input);
        touched.add(ref.key);
        const info = await base.upload({ ...input, ...ref });
        return { ...info, bucket: input.bucket, key: input.key };
      },
      stat: async (ref: Parameters<typeof base.stat>[0]) => {
        const info = await base.stat(map(ref));
        return info && { ...info, bucket: ref.bucket, key: ref.key };
      },
      read: (ref: Parameters<typeof base.read>[0], options?: Parameters<typeof base.read>[1]) =>
        base.read(map(ref), options),
      signedReadUrl: (ref: Parameters<typeof base.signedReadUrl>[0], expiry: number) =>
        base.signedReadUrl(map(ref), expiry),
      delete: (ref: Parameters<typeof base.delete>[0]) => base.delete(map(ref)),
      copy: async (
        source: Parameters<typeof base.copy>[0],
        destination: Parameters<typeof base.copy>[1],
      ) => {
        touched.add(map(destination).key);
        const info = await base.copy(map(source), map(destination));
        return { ...info, bucket: destination.bucket, key: destination.key };
      },
      move: async (
        source: Parameters<typeof base.move>[0],
        destination: Parameters<typeof base.move>[1],
      ) => {
        touched.add(map(destination).key);
        const info = await base.move(map(source), map(destination));
        return { ...info, bucket: destination.bucket, key: destination.key };
      },
      health: () => base.health(),
    } satisfies StorageProvider;
    return wrap;
  }

  beforeAll(async () => {
    config = localConfig();
    provider = new MinioStorageProvider(config);
    const health = await provider.health();
    if (!health.healthy) throw new Error(`Local MinIO is not ready (${health.reason}).`);
  });

  afterAll(async () => {
    if (!provider) return;
    await Promise.all([...touched].map((key) => provider.delete({ bucket: config.bucket, key })));
  });

  storageProviderContract("MinIO", isolatedProvider);

  describe("MinIO provider configuration", () => {
    it("generates collision-resistant, partitioned object keys", () => {
      const first = createMediaObjectKey("originals", "jpg");
      const second = createMediaObjectKey("originals", "jpg");
      expect(first).toMatch(/^originals\/\d{4}\/\d{2}\/\d{2}\/[0-9a-f-]{36}\.jpg$/u);
      expect(second).not.toBe(first);
    });

    it("rejects cross-bucket access before contacting MinIO", async () => {
      await expect(
        provider.stat({ bucket: "other-bucket", key: "originals/meal.jpg" }),
      ).rejects.toMatchObject({ code: "invalid_input" });
    });

    it("streams a multipart-sized object and preserves the exact byte length", async () => {
      const key = `contract/${crypto.randomUUID()}/large.mp4`;
      touched.add(key);
      const part = new Uint8Array(1024 * 1024).fill(0x2a);
      const totalBytes = 17 * part.length;
      let emitted = 0;
      const body = new ReadableStream<Uint8Array>({
        pull(controller) {
          if (emitted === 17) return controller.close();
          controller.enqueue(part);
          emitted += 1;
        },
      });
      const uploaded = await provider.upload({
        bucket: config.bucket,
        key,
        contentLength: totalBytes,
        contentType: "video/mp4",
        body,
      });
      expect(uploaded.bytes).toBe(totalBytes);
      const ranged = await provider.read(
        { bucket: config.bucket, key },
        { start: totalBytes - 8, end: totalBytes - 1 },
      );
      expect(ranged.bytes).toBe(8);
      const reader = ranged.body.getReader();
      const chunk = await reader.read();
      expect(chunk.value?.byteLength).toBe(8);
      await reader.cancel();
    }, 30_000);

    it("keeps objects private but permits a short-lived signed GET", async () => {
      const key = `contract/${crypto.randomUUID()}/private.txt`;
      touched.add(key);
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("Sara"));
          controller.close();
        },
      });
      const ref = { bucket: config.bucket, key };
      await provider.upload({ ...ref, contentLength: 4, contentType: "text/plain", body });
      const signed = await provider.signedReadUrl(ref, 30);
      const authorized = await fetch(signed.url);
      expect(authorized.status).toBe(200);
      expect(await authorized.text()).toBe("Sara");
      const unsigned = new URL(signed.url);
      unsigned.search = "";
      const anonymous = await fetch(unsigned);
      expect(anonymous.status).toBe(403);
    });
  });
});
