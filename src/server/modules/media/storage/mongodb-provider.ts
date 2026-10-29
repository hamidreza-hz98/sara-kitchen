import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { Readable } from "node:stream";
import { mongo } from "mongoose";

import { connectToDatabase } from "@/server/database";
import { getApplicationSiteUrl, getServerEnvironment } from "@/server/environment";
import { isSafeMediaObjectKey } from "../validation/media-metadata";
import {
  StorageError,
  type StorageProvider,
  type StorageObjectRef,
  type StorageObjectInfo,
  type StorageUpload,
  type StorageReadOptions,
} from "./storage-provider";

export const MONGODB_MEDIA_BUCKET = "mongo-media";
const COLLECTION = "media_gridfs";

function validate(ref: StorageObjectRef) {
  if (ref.bucket !== MONGODB_MEDIA_BUCKET || !isSafeMediaObjectKey(ref.key))
    throw new StorageError("invalid_input");
}

async function bucket() {
  const connection = await connectToDatabase();
  if (!connection.db) throw new StorageError("unavailable");
  return new mongo.GridFSBucket(
    connection.db as unknown as ConstructorParameters<typeof mongo.GridFSBucket>[0],
    { bucketName: COLLECTION },
  );
}

function signature(key: string, expiry: number) {
  return createHmac("sha256", getServerEnvironment().AUTH_SESSION_SECRET)
    .update(`${expiry}:${key}`)
    .digest("hex");
}

export function verifyMongoMediaSignature(key: string, expiry: number, token: string): boolean {
  if (
    !isSafeMediaObjectKey(key) ||
    !Number.isSafeInteger(expiry) ||
    expiry < Date.now() ||
    expiry > Date.now() + 900_000 ||
    !/^[a-f0-9]{64}$/.test(token)
  )
    return false;
  return timingSafeEqual(Buffer.from(token, "hex"), Buffer.from(signature(key, expiry), "hex"));
}

function info(
  ref: StorageObjectRef,
  file: {
    length: number;
    uploadDate: Date;
    metadata?: { contentType?: string };
    _id: mongo.ObjectId;
  },
): StorageObjectInfo {
  return {
    ...ref,
    bytes: file.length,
    contentType: file.metadata?.contentType ?? "application/octet-stream",
    etag: file._id.toHexString(),
    lastModified: file.uploadDate,
  };
}

export class MongoDbStorageProvider implements StorageProvider {
  async stat(ref: StorageObjectRef) {
    validate(ref);
    try {
      const file = await (await bucket()).find({ filename: ref.key }).limit(1).next();
      return file ? info(ref, file) : null;
    } catch {
      throw new StorageError("unavailable");
    }
  }

  async upload(input: StorageUpload) {
    validate(input);
    if (!Number.isSafeInteger(input.contentLength) || input.contentLength < 0 || !input.contentType)
      throw new StorageError("invalid_input");
    if (await this.stat(input)) throw new StorageError("already_exists");
    const connection = await connectToDatabase();
    if (!connection.db) throw new StorageError("unavailable");
    // Reservation makes create-only semantics atomic across concurrent requests.
    const reservations = connection.db.collection("media_object_reservations");
    try {
      await reservations.insertOne({ _id: input.key as never });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === 11000)
        throw new StorageError("already_exists");
      throw new StorageError("unavailable");
    }
    const grid = await bucket();
    const output = grid.openUploadStream(input.key, {
      metadata: { contentType: input.contentType },
    });
    let count = 0;
    try {
      const reader = input.body.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          count += value.byteLength;
          if (count > input.contentLength) throw new StorageError("length_mismatch");
          if (!output.write(Buffer.from(value)))
            await new Promise<void>((resolve) => output.once("drain", resolve));
        }
      } finally {
        reader.releaseLock();
      }
      if (count !== input.contentLength) throw new StorageError("length_mismatch");
      await new Promise<void>((resolve, reject) =>
        output.end((error?: Error | null) => (error ? reject(error) : resolve())),
      );
      const result = await this.stat(input);
      if (!result) throw new StorageError("unavailable");
      return result;
    } catch (error) {
      await output.abort().catch(() => undefined);
      await reservations.deleteOne({ _id: input.key as never }).catch(() => undefined);
      throw error instanceof StorageError ? error : new StorageError("unavailable");
    }
  }

  async read(ref: StorageObjectRef, options: StorageReadOptions = {}) {
    validate(ref);
    const metadata = await this.stat(ref);
    if (!metadata) throw new StorageError("not_found");
    const start = options.start ?? 0;
    const end = options.end ?? metadata.bytes - 1;
    if (
      (options.end !== undefined && options.start === undefined) ||
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < 0 ||
      end < start ||
      end >= metadata.bytes
    )
      throw new StorageError("invalid_input");
    const grid = await bucket();
    const file = await grid.find({ filename: ref.key }).limit(1).next();
    if (!file) throw new StorageError("not_found");
    return {
      body: Readable.toWeb(
        grid.openDownloadStream(file._id, { start, end: end + 1 }),
      ) as ReadableStream<Uint8Array>,
      bytes: end - start + 1,
      totalBytes: metadata.bytes,
      contentType: metadata.contentType,
    };
  }

  async signedReadUrl(ref: StorageObjectRef, expiresInSeconds: number) {
    validate(ref);
    if (!Number.isInteger(expiresInSeconds) || expiresInSeconds < 1 || expiresInSeconds > 900)
      throw new StorageError("invalid_input");
    if (!(await this.stat(ref))) throw new StorageError("not_found");
    const expiry = Date.now() + expiresInSeconds * 1000;
    return {
      url: new URL(
        `/api/media/file?key=${encodeURIComponent(ref.key)}&expires=${expiry}&token=${signature(ref.key, expiry)}`,
        getApplicationSiteUrl(),
      ).href,
      expiresAt: new Date(expiry),
    };
  }

  async delete(ref: StorageObjectRef) {
    validate(ref);
    const grid = await bucket();
    const file = await grid.find({ filename: ref.key }).limit(1).next();
    if (file)
      await grid.delete(file._id).catch(() => {
        throw new StorageError("unavailable");
      });
    const connection = await connectToDatabase();
    await connection.db
      ?.collection("media_object_reservations")
      .deleteOne({ _id: ref.key as never });
  }

  async copy(source: StorageObjectRef, destination: StorageObjectRef) {
    validate(source);
    validate(destination);
    if (source.key === destination.key) throw new StorageError("already_exists");
    const sourceInfo = await this.stat(source);
    if (!sourceInfo) throw new StorageError("not_found");
    const read = await this.read(source);
    return this.upload({
      ...destination,
      contentLength: sourceInfo.bytes,
      contentType: sourceInfo.contentType,
      body: read.body,
    });
  }

  async move(source: StorageObjectRef, destination: StorageObjectRef) {
    const result = await this.copy(source, destination);
    await this.delete(source);
    return result;
  }

  async health() {
    const checkedAt = new Date();
    try {
      await (await connectToDatabase()).db?.admin().ping();
      return { healthy: true, checkedAt, reason: "ok" as const };
    } catch {
      return { healthy: false, checkedAt, reason: "unreachable" as const };
    }
  }
}
