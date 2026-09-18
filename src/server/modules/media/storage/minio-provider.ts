import "server-only";

import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";

import { Client as MinioClient, CopyDestinationOptions, CopySourceOptions } from "minio";

import { getServerEnvironment } from "@/server/environment";

import { isSafeMediaObjectKey } from "../validation/media-metadata";
import type { UploadExtension } from "../validation/upload-policy";
import {
  StorageError,
  type StorageHealth,
  type StorageObjectInfo,
  type StorageObjectRef,
  type StorageProvider,
  type StorageReadOptions,
  type StorageReadResult,
  type StorageSignedReadUrl,
  type StorageUpload,
} from "./storage-provider";

export interface MinioProviderConfig {
  readonly endpoint: string;
  readonly port: number;
  readonly useSSL: boolean;
  readonly accessKey: string;
  readonly secretKey: string;
  readonly bucket: string;
  readonly region: string;
}

export function createMediaObjectKey(
  scope: "originals" | "variants",
  extension: UploadExtension,
): string {
  const day = new Date().toISOString().slice(0, 10).replaceAll("-", "/");
  return `${scope}/${day}/${randomUUID()}.${extension}`;
}

function errorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
  return typeof error.code === "string" ? error.code : undefined;
}

function translate(error: unknown): StorageError {
  if (error instanceof StorageError) return error;
  const code = errorCode(error);
  if (code === "NoSuchKey" || code === "NotFound" || code === "NoSuchObject") {
    return new StorageError("not_found");
  }
  if (code === "PreconditionFailed" || code === "ConditionalRequestConflict") {
    return new StorageError("already_exists");
  }
  if (
    code === "AccessDenied" ||
    code === "InvalidAccessKeyId" ||
    code === "SignatureDoesNotMatch"
  ) {
    return new StorageError("unauthorized");
  }
  return new StorageError("unavailable");
}

function contentType(metadata: Record<string, unknown>): string {
  const value = metadata["content-type"] ?? metadata["Content-Type"];
  return typeof value === "string" ? value : "application/octet-stream";
}

export class MinioStorageProvider implements StorageProvider {
  private readonly client: MinioClient;
  private readonly bucket: string;

  constructor(config: MinioProviderConfig) {
    this.bucket = config.bucket;
    this.client = new MinioClient({
      endPoint: config.endpoint,
      port: config.port,
      useSSL: config.useSSL,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
      region: config.region,
      partSize: 16 * 1024 * 1024,
      retryOptions: { disableRetry: true },
    });
  }

  private validateRef(ref: StorageObjectRef): void {
    if (ref.bucket !== this.bucket || !isSafeMediaObjectKey(ref.key)) {
      throw new StorageError("invalid_input");
    }
  }

  private async run<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      throw translate(error);
    }
  }

  async upload(input: StorageUpload): Promise<StorageObjectInfo> {
    this.validateRef(input);
    if (
      !Number.isSafeInteger(input.contentLength) ||
      input.contentLength < 0 ||
      !input.contentType
    ) {
      throw new StorageError("invalid_input");
    }
    if (await this.stat(input)) throw new StorageError("already_exists");
    const reader = input.body.getReader();
    let readBytes = 0;
    const counted = Readable.from(
      (async function* () {
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            readBytes += value.byteLength;
            if (readBytes > input.contentLength) throw new StorageError("length_mismatch");
            yield Buffer.from(value);
          }
          if (readBytes !== input.contentLength) throw new StorageError("length_mismatch");
        } finally {
          reader.releaseLock();
        }
      })(),
    );
    // A single PUT uses the conditional header. MinIO SDK automatically uses multipart
    // when the declared size exceeds its part-size threshold.
    await this.run(() =>
      this.client.putObject(input.bucket, input.key, counted, input.contentLength, {
        "Content-Type": input.contentType,
        "If-None-Match": "*",
      }),
    );
    const result = await this.stat(input);
    if (!result) throw new StorageError("unavailable");
    return result;
  }

  async stat(ref: StorageObjectRef): Promise<StorageObjectInfo | null> {
    this.validateRef(ref);
    try {
      let item;
      try {
        item = await this.client.statObject(ref.bucket, ref.key);
      } catch (error) {
        // An aborted upload can leave a stale keep-alive socket in the SDK's pool.
        // A metadata read is safe to retry once on that transport failure.
        if (errorCode(error) !== "ECONNRESET") throw error;
        item = await this.client.statObject(ref.bucket, ref.key);
      }
      return {
        ...ref,
        bytes: item.size,
        contentType: contentType(item.metaData),
        etag: item.etag ?? null,
        lastModified: item.lastModified,
      };
    } catch (error) {
      if (translate(error).code === "not_found") return null;
      throw translate(error);
    }
  }

  async read(ref: StorageObjectRef, options: StorageReadOptions = {}): Promise<StorageReadResult> {
    this.validateRef(ref);
    const info = await this.stat(ref);
    if (!info) throw new StorageError("not_found");
    const { start = 0, end = info.bytes - 1 } = options;
    if (
      (options.end !== undefined && options.start === undefined) ||
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < 0 ||
      end < start ||
      end >= info.bytes
    ) {
      throw new StorageError("invalid_input");
    }
    const length = end - start + 1;
    const stream = await this.run(() =>
      options.start === undefined
        ? this.client.getObject(ref.bucket, ref.key)
        : this.client.getPartialObject(ref.bucket, ref.key, start, length),
    );
    return {
      body: Readable.toWeb(stream) as ReadableStream<Uint8Array>,
      bytes: length,
      totalBytes: info.bytes,
      contentType: info.contentType,
    };
  }

  async signedReadUrl(
    ref: StorageObjectRef,
    expiresInSeconds: number,
  ): Promise<StorageSignedReadUrl> {
    this.validateRef(ref);
    if (!Number.isInteger(expiresInSeconds) || expiresInSeconds < 1 || expiresInSeconds > 900) {
      throw new StorageError("invalid_input");
    }
    if (!(await this.stat(ref))) throw new StorageError("not_found");
    const issuedAt = new Date();
    const url = await this.run(() =>
      this.client.presignedGetObject(ref.bucket, ref.key, expiresInSeconds),
    );
    return { url, expiresAt: new Date(issuedAt.getTime() + expiresInSeconds * 1000) };
  }

  async delete(ref: StorageObjectRef): Promise<void> {
    this.validateRef(ref);
    await this.run(() => this.client.removeObject(ref.bucket, ref.key));
  }

  async copy(source: StorageObjectRef, destination: StorageObjectRef): Promise<StorageObjectInfo> {
    this.validateRef(source);
    this.validateRef(destination);
    if (source.key === destination.key) throw new StorageError("already_exists");
    if (!(await this.stat(source))) throw new StorageError("not_found");
    if (await this.stat(destination)) throw new StorageError("already_exists");
    await this.run(() =>
      this.client.copyObject(
        new CopySourceOptions({ Bucket: source.bucket, Object: source.key }),
        new CopyDestinationOptions({
          Bucket: destination.bucket,
          Object: destination.key,
          Headers: { "If-None-Match": "*" },
        }),
      ),
    );
    const copied = await this.stat(destination);
    if (!copied) throw new StorageError("unavailable");
    return copied;
  }

  async move(source: StorageObjectRef, destination: StorageObjectRef): Promise<StorageObjectInfo> {
    const copied = await this.copy(source, destination);
    await this.delete(source);
    return copied;
  }

  async health(): Promise<StorageHealth> {
    const checkedAt = new Date();
    try {
      const exists = await this.client.bucketExists(this.bucket);
      return { healthy: exists, checkedAt, reason: exists ? "ok" : "bucket_missing" };
    } catch (error) {
      const code = translate(error).code;
      return {
        healthy: false,
        checkedAt,
        reason: code === "unauthorized" ? "unauthorized" : "unreachable",
      };
    }
  }
}

export function createMinioStorageProvider(): MinioStorageProvider {
  const env = getServerEnvironment();
  return new MinioStorageProvider({
    endpoint: env.MINIO_ENDPOINT,
    port: env.MINIO_PORT,
    useSSL: env.MINIO_USE_SSL,
    accessKey: env.MINIO_ACCESS_KEY,
    secretKey: env.MINIO_SECRET_KEY,
    bucket: env.MINIO_BUCKET,
    region: env.MINIO_REGION,
  });
}
