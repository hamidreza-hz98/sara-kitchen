import "server-only";

import { Types } from "mongoose";
import type { Connection } from "mongoose";

import { createActorMetadata } from "@/server/database";

import { getMediaModel } from "../model/media";

export type MediaDeleteRepositoryResult =
  | Readonly<{ status: "deleted"; deletedAt: Date }>
  | Readonly<{ status: "not_found" }>
  | Readonly<{ status: "referenced"; referenceCount: number }>;

export interface MediaDeleteRepository {
  /**
   * Atomically soft-delete only an active record whose reference count is zero.
   * A concurrent reference increment therefore wins over deletion safely.
   */
  softDeleteUnreferenced(
    id: string,
    actorId: string,
    deletedAt: Date,
  ): Promise<MediaDeleteRepositoryResult>;
}

export function createMediaDeleteRepository(connection: Connection): MediaDeleteRepository {
  const Media = getMediaModel(connection);

  return {
    async softDeleteUnreferenced(id, actorId, deletedAt) {
      if (!Types.ObjectId.isValid(id)) return { status: "not_found" };
      const mediaId = new Types.ObjectId(id);
      const actor = createActorMetadata("admin", actorId);
      const deleted = await Media.findOneAndUpdate(
        { _id: mediaId, deletedAt: null, usageCount: 0 },
        { $set: { deletedAt, deletedBy: actor, updatedBy: actor } },
        { projection: { deletedAt: 1 }, returnDocument: "after", runValidators: true },
      ).lean<{ deletedAt: Date }>();

      if (deleted) return { status: "deleted", deletedAt: deleted.deletedAt };

      const active = await Media.findOne(
        { _id: mediaId, deletedAt: null },
        { usageCount: 1 },
      ).lean<{ usageCount: number }>();
      if (!active) return { status: "not_found" };

      return { status: "referenced", referenceCount: active.usageCount };
    },
  };
}
