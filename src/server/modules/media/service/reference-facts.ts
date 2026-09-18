import "server-only";

import { Types } from "mongoose";
import type { Connection } from "mongoose";

import { getMediaModel } from "../model/media";
import type { MediaKind, MediaProcessingState } from "../validation/media-metadata";

export type MediaReferenceFacts = Readonly<{
  id: string;
  kind: MediaKind;
  processingState: MediaProcessingState;
}>;

/** Public Media boundary for other modules that need to validate references. */
export async function getMediaReferenceFacts(
  connection: Connection,
  ids: readonly string[],
): Promise<readonly MediaReferenceFacts[]> {
  if (ids.length === 0) return [];
  const unique = [...new Set(ids)];
  const records = await getMediaModel(connection)
    .find({ _id: { $in: unique.map((id) => new Types.ObjectId(id)) }, deletedAt: null })
    .select({ _id: 1, kind: 1, processingState: 1 })
    .lean()
    .exec();
  return records.map((record) => ({
    id: record._id.toHexString(),
    kind: record.kind,
    processingState: record.processingState,
  }));
}
