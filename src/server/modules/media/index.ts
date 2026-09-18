/** Public entry point for media metadata, storage, and processing use cases. */
export const MODULE_NAME = "media" as const;

export { StorageError } from "./storage/storage-provider";
export type {
  StorageErrorCode,
  StorageHealth,
  StorageObjectInfo,
  StorageObjectRef,
  StorageProvider,
  StorageReadOptions,
  StorageReadResult,
  StorageSignedReadUrl,
  StorageUpload,
} from "./storage/storage-provider";

export {
  UPLOAD_POLICY,
  UploadPolicyError,
  inspectUpload,
  inspectUploadBatch,
} from "./validation/upload-policy";
export type {
  InspectedUpload,
  UploadCandidate,
  UploadExtension,
  UploadPolicyCode,
  UploadQuotaSnapshot,
} from "./validation/upload-policy";
