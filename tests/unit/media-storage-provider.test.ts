import { StorageError } from "@/server/modules/media";
import type {
  StorageHealth,
  StorageObjectInfo,
  StorageObjectRef,
  StorageProvider,
  StorageReadOptions,
  StorageReadResult,
  StorageSignedReadUrl,
  StorageUpload,
} from "@/server/modules/media";

import { storageProviderContract } from "../contracts/storage-provider.contract";

function refKey(ref: StorageObjectRef): string {
  if (
    !ref.bucket ||
    !/^[a-z0-9-]+$/u.test(ref.bucket) ||
    !/^[a-z0-9][a-z0-9/.-]+$/u.test(ref.key)
  ) {
    throw new StorageError("invalid_input");
  }
  return `${ref.bucket}/${ref.key}`;
}

function bodyOf(value: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(value);
      controller.close();
    },
  });
}

/** In-memory contract adapter, deliberately independent of MinIO. */
class FakeStorageProvider implements StorageProvider {
  private readonly objects = new Map<string, { info: StorageObjectInfo; data: Uint8Array }>();

  async upload(input: StorageUpload): Promise<StorageObjectInfo> {
    const key = refKey(input);
    if (this.objects.has(key)) throw new StorageError("already_exists");
    if (
      !Number.isSafeInteger(input.contentLength) ||
      input.contentLength < 0 ||
      !input.contentType
    ) {
      throw new StorageError("invalid_input");
    }
    const chunks: Uint8Array[] = [];
    let length = 0;
    const reader = input.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      length += value.length;
      if (length > input.contentLength) throw new StorageError("length_mismatch");
    }
    if (length !== input.contentLength) throw new StorageError("length_mismatch");
    const data = Uint8Array.from(Buffer.concat(chunks));
    const info: StorageObjectInfo = {
      bucket: input.bucket,
      key: input.key,
      bytes: length,
      contentType: input.contentType,
      etag: null,
      lastModified: new Date(),
    };
    this.objects.set(key, { info, data });
    return info;
  }

  async stat(ref: StorageObjectRef): Promise<StorageObjectInfo | null> {
    return this.objects.get(refKey(ref))?.info ?? null;
  }

  async read(ref: StorageObjectRef, options: StorageReadOptions = {}): Promise<StorageReadResult> {
    const object = this.objects.get(refKey(ref));
    if (!object) throw new StorageError("not_found");
    const { start = 0, end = object.data.length - 1 } = options;
    if (
      (options.end !== undefined && options.start === undefined) ||
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < 0 ||
      end < start ||
      end >= object.data.length
    ) {
      throw new StorageError("invalid_input");
    }
    const data = object.data.slice(start, end + 1);
    return {
      body: bodyOf(data),
      bytes: data.length,
      totalBytes: object.info.bytes,
      contentType: object.info.contentType,
    };
  }

  async signedReadUrl(
    ref: StorageObjectRef,
    expiresInSeconds: number,
  ): Promise<StorageSignedReadUrl> {
    if (!Number.isInteger(expiresInSeconds) || expiresInSeconds < 1 || expiresInSeconds > 900) {
      throw new StorageError("invalid_input");
    }
    if (!(await this.stat(ref))) throw new StorageError("not_found");
    return {
      url: `https://fake.invalid/${encodeURIComponent(ref.bucket)}/${encodeURIComponent(ref.key)}?signed=redacted`,
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
    };
  }

  async delete(ref: StorageObjectRef): Promise<void> {
    this.objects.delete(refKey(ref));
  }

  async copy(source: StorageObjectRef, destination: StorageObjectRef): Promise<StorageObjectInfo> {
    const existing = this.objects.get(refKey(source));
    if (!existing) throw new StorageError("not_found");
    const destinationKey = refKey(destination);
    if (this.objects.has(destinationKey)) throw new StorageError("already_exists");
    const info = { ...existing.info, ...destination, lastModified: new Date() };
    this.objects.set(destinationKey, { info, data: existing.data.slice() });
    return info;
  }

  async move(source: StorageObjectRef, destination: StorageObjectRef): Promise<StorageObjectInfo> {
    const copied = await this.copy(source, destination);
    await this.delete(source);
    return copied;
  }

  async health(): Promise<StorageHealth> {
    return { healthy: true, checkedAt: new Date(), reason: "ok" };
  }
}

storageProviderContract("fake", () => new FakeStorageProvider());
