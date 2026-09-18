import "server-only";

import { Types } from "mongoose";
import type { Connection } from "mongoose";

import type { SupportedLocale } from "@/constants";

import { getMediaModel } from "../model/media";
import type { MediaVariant } from "../model/media";

export interface MediaUploadRecord {
  readonly originalName: string;
  readonly objectKey: string;
  readonly bucket: string;
  readonly mimeType: string;
  readonly bytes: number;
  readonly checksum: string;
  readonly dimensions: { readonly width: number; readonly height: number };
  readonly variants: readonly MediaVariant[];
  readonly translations: readonly { readonly locale: SupportedLocale; readonly alt: string }[];
  readonly uploaderId: string;
}

export interface MediaUploadRepository {
  findActiveByChecksum(checksum: string): Promise<string | null>;
  quotaUsage(
    uploaderId: string,
  ): Promise<{ adminRollingDayBytes: number; activeStorageBytes: number }>;
  create(record: MediaUploadRecord): Promise<{ id: string }>;
}

export function createMediaUploadRepository(connection: Connection): MediaUploadRepository {
  const Media = getMediaModel(connection);
  return {
    async findActiveByChecksum(checksum) {
      const found = await Media.findOne({
        checksum,
        source: "managed",
        processingState: "ready",
        deletedAt: null,
      })
        .select("_id")
        .lean();
      return found?._id.toString() ?? null;
    },
    async quotaUsage(uploaderId) {
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [usage] = await Media.aggregate<{
        adminRollingDayBytes: number;
        activeStorageBytes: number;
      }>([
        { $match: { source: "managed", deletedAt: null } },
        {
          $group: {
            _id: null,
            activeStorageBytes: {
              $sum: { $add: ["$bytes", { $sum: "$variants.bytes" }] },
            },
            adminRollingDayBytes: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$uploaderId", new Types.ObjectId(uploaderId)] },
                      { $gte: ["$createdAt", dayAgo] },
                    ],
                  },
                  "$bytes",
                  0,
                ],
              },
            },
          },
        },
      ]);
      return {
        adminRollingDayBytes: usage?.adminRollingDayBytes ?? 0,
        activeStorageBytes: usage?.activeStorageBytes ?? 0,
      };
    },
    async create(record) {
      const created = await Media.create({
        source: "managed",
        provider: "minio",
        bucket: record.bucket,
        objectKey: record.objectKey,
        externalUrl: null,
        originalName: record.originalName,
        mimeType: record.mimeType,
        kind: "image",
        bytes: record.bytes,
        dimensions: record.dimensions,
        durationMs: null,
        pageCount: null,
        checksum: record.checksum,
        processingState: "ready",
        failureCode: null,
        variants: record.variants.map((variant) => ({ ...variant })),
        translations: record.translations.map((translation) => ({ ...translation })),
        uploaderId: new Types.ObjectId(record.uploaderId),
        usageCount: 0,
      });
      return { id: created._id.toString() };
    },
  };
}
