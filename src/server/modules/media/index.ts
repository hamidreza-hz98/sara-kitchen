/** Public entry point for media metadata, storage, and processing use cases. */
export const MODULE_NAME = "media" as const;

export {
  IMAGE_PROCESSING_POLICY,
  ImageProcessingError,
  processImage,
} from "./processing/image-processor";
export type {
  ImageMimeType,
  ImageProcessingErrorCode,
  ImageVariantOutput,
  ImageVariantRole,
  ProcessedImage,
} from "./processing/image-processor";
export {
  INLINE_PROCESSING_POLICY,
  planMediaProcessing,
  processImageForRoute,
} from "./processing/serverless-processing";
export type { MediaProcessingPlan } from "./processing/serverless-processing";
export { createMediaUploadRepository } from "./repository/media-upload";
export type { MediaUploadRecord, MediaUploadRepository } from "./repository/media-upload";
export { createMediaUpload, MediaUploadError } from "./service/create-upload";
export type {
  CreateMediaUploadDependencies,
  CreateMediaUploadInput,
  MediaUploadErrorCode,
} from "./service/create-upload";

export { StorageError } from "./storage/storage-provider";
export {
  createMediaObjectKey,
  createMinioStorageProvider,
  MinioStorageProvider,
} from "./storage/minio-provider";
export type { MinioProviderConfig } from "./storage/minio-provider";
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
