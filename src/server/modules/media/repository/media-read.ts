import "server-only";

import { Types } from "mongoose";
import type { Connection } from "mongoose";

import { getMediaModel } from "../model/media";
import type {
  MediaAltTranslation,
  MediaDimensions,
  MediaRecord,
  MediaVariant,
} from "../model/media";
import type { MediaKind, MediaProcessingState, MediaSource } from "../validation/media-metadata";
import type { MediaListQueryPlan } from "../validation/media-read-query";

export type MediaReadRecord = Readonly<{
  id: string;
  source: MediaSource;
  bucket: string | null;
  objectKey: string | null;
  externalUrl: string | null;
  originalName: string;
  mimeType: string;
  kind: MediaKind;
  bytes: number | null;
  dimensions: MediaDimensions | null;
  durationMs: number | null;
  pageCount: number | null;
  processingState: MediaProcessingState;
  failureCode: string | null;
  variants: readonly MediaVariant[];
  translations: readonly MediaAltTranslation[];
  uploaderId: string;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}>;

export interface MediaReadRepository {
  list(plan: MediaListQueryPlan): Promise<{ items: readonly MediaReadRecord[]; total: number }>;
  findById(id: string): Promise<MediaReadRecord | null>;
}

const projection = {
  source: 1,
  bucket: 1,
  objectKey: 1,
  externalUrl: 1,
  originalName: 1,
  mimeType: 1,
  kind: 1,
  bytes: 1,
  dimensions: 1,
  durationMs: 1,
  pageCount: 1,
  processingState: 1,
  failureCode: 1,
  variants: 1,
  translations: 1,
  uploaderId: 1,
  usageCount: 1,
  createdAt: 1,
  updatedAt: 1,
} as const;

function toRecord(value: MediaRecord): MediaReadRecord {
  return {
    id: value._id.toString(),
    source: value.source,
    bucket: value.bucket,
    objectKey: value.objectKey,
    externalUrl: value.externalUrl,
    originalName: value.originalName,
    mimeType: value.mimeType,
    kind: value.kind,
    bytes: value.bytes,
    dimensions: value.dimensions,
    durationMs: value.durationMs,
    pageCount: value.pageCount,
    processingState: value.processingState,
    failureCode: value.failureCode,
    variants: value.variants,
    translations: value.translations,
    uploaderId: value.uploaderId.toString(),
    usageCount: value.usageCount,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

export function createMediaReadRepository(connection: Connection): MediaReadRepository {
  const Media = getMediaModel(connection);
  return {
    async list(plan) {
      const filter = plan.filter;
      const [items, total] = await Promise.all([
        Media.find(filter, projection)
          .sort(plan.sort)
          .skip(plan.skip)
          .limit(plan.limit)
          .lean<MediaRecord[]>(),
        Media.countDocuments(filter),
      ]);
      return { items: items.map(toRecord), total };
    },
    async findById(id) {
      if (!Types.ObjectId.isValid(id)) return null;
      const item = await Media.findOne({ _id: new Types.ObjectId(id), deletedAt: null }, projection)
        .lean<MediaRecord>()
        .exec();
      return item ? toRecord(item) : null;
    },
  };
}
