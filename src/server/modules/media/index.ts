/** Public entry point for media metadata, storage, and processing use cases. */
export const MODULE_NAME = "media" as const;

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
