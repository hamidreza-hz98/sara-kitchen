import "server-only";

import { getServerEnvironment } from "@/server/environment";
import { getMinioConfiguration } from "@/validations/env/server-schema";
import { createMinioStorageProvider } from "./minio-provider";
import { MONGODB_MEDIA_BUCKET, MongoDbStorageProvider } from "./mongodb-provider";
import {
  StorageError,
  type StorageProvider,
  type StorageObjectRef,
  type StorageUpload,
  type StorageReadOptions,
} from "./storage-provider";

export function activeMediaBucket(): string {
  const env = getServerEnvironment();
  return env.MEDIA_STORAGE_PROVIDER === "mongodb"
    ? MONGODB_MEDIA_BUCKET
    : getMinioConfiguration(env).bucket;
}

export function createMediaStorageProvider(): StorageProvider {
  const mongo = new MongoDbStorageProvider();
  const minio = () => createMinioStorageProvider();
  const select = (ref: StorageObjectRef) => (ref.bucket === MONGODB_MEDIA_BUCKET ? mongo : minio());
  return {
    upload: (input: StorageUpload) => select(input).upload(input),
    stat: (ref: StorageObjectRef) => select(ref).stat(ref),
    read: (ref: StorageObjectRef, options?: StorageReadOptions) => select(ref).read(ref, options),
    signedReadUrl: (ref, seconds) => select(ref).signedReadUrl(ref, seconds),
    delete: (ref) => select(ref).delete(ref),
    copy: async (source, destination) => {
      if (source.bucket === destination.bucket) return select(source).copy(source, destination);
      const original = await select(source).stat(source);
      if (!original) throw new StorageError("not_found");
      const content = await select(source).read(source);
      return select(destination).upload({
        ...destination,
        contentLength: original.bytes,
        contentType: original.contentType,
        body: content.body,
      });
    },
    move: async (source, destination) => {
      if (source.bucket === destination.bucket) return select(source).move(source, destination);
      const original = await select(source).stat(source);
      if (!original) throw new StorageError("not_found");
      const content = await select(source).read(source);
      const copied = await select(destination).upload({
        ...destination,
        contentLength: original.bytes,
        contentType: original.contentType,
        body: content.body,
      });
      await select(source).delete(source);
      return copied;
    },
    health: () =>
      getServerEnvironment().MEDIA_STORAGE_PROVIDER === "mongodb"
        ? mongo.health()
        : minio().health(),
  };
}
