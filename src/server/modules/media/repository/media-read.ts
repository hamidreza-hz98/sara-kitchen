import "server-only";

import { Types } from "mongoose";
import type { Connection, Model } from "mongoose";

import { getBlogModel } from "@/server/modules/blogs/model/blog";
import { getCategoryModel } from "@/server/modules/categories/model/category";
import { getDishModel } from "@/server/modules/dishes/model/dish";
import { getIngredientModel } from "@/server/modules/ingredients/model/ingredient";
import { getPageSeoModel } from "@/server/modules/seo/model/page-seo";

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

type ReferenceCountRow = Readonly<{ _id: Types.ObjectId; count: number }>;

async function countReferenceField<T>(
  model: Model<T>,
  field: string,
  mediaIds: readonly Types.ObjectId[],
  array = false,
): Promise<readonly ReferenceCountRow[]> {
  const path = `$${field}`;
  return model.aggregate<ReferenceCountRow>([
    { $match: { deletedAt: null, [field]: { $in: mediaIds } } },
    ...(array ? [{ $unwind: path }] : []),
    { $match: { [field]: { $in: mediaIds } } },
    { $group: { _id: path, count: { $sum: 1 } } },
  ]);
}

async function actualUsageCounts(
  connection: Connection,
  ids: readonly string[],
): Promise<ReadonlyMap<string, number>> {
  const mediaIds = ids.map((id) => new Types.ObjectId(id));
  const groups = await Promise.all([
    countReferenceField(getDishModel(connection), "mediaIds", mediaIds, true),
    countReferenceField(getCategoryModel(connection), "imageMediaId", mediaIds),
    countReferenceField(getCategoryModel(connection), "bannerMediaId", mediaIds),
    countReferenceField(getBlogModel(connection), "imageMediaId", mediaIds),
    countReferenceField(getBlogModel(connection), "bannerMediaId", mediaIds),
    countReferenceField(getIngredientModel(connection), "imageMediaId", mediaIds),
    countReferenceField(getPageSeoModel(connection), "shareImageMediaId", mediaIds),
  ]);
  const counts = new Map<string, number>();
  for (const group of groups) {
    for (const row of group) {
      const id = row._id.toHexString();
      counts.set(id, (counts.get(id) ?? 0) + row.count);
    }
  }
  return counts;
}

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
      const counts = await actualUsageCounts(
        connection,
        items.map((item) => item._id.toString()),
      );
      return {
        items: items.map((item) => ({
          ...toRecord(item),
          usageCount: counts.get(item._id.toString()) ?? 0,
        })),
        total,
      };
    },
    async findById(id) {
      if (!Types.ObjectId.isValid(id)) return null;
      const item = await Media.findOne({ _id: new Types.ObjectId(id), deletedAt: null }, projection)
        .lean<MediaRecord>()
        .exec();
      if (!item) return null;
      const counts = await actualUsageCounts(connection, [item._id.toString()]);
      return { ...toRecord(item), usageCount: counts.get(item._id.toString()) ?? 0 };
    },
  };
}
