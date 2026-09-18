import "server-only";

import { Types } from "mongoose";
import type { Connection } from "mongoose";

import { createActorMetadata } from "@/server/database";

import { getMediaModel } from "../model/media";
import type { MediaAltTranslation } from "../model/media";

export type MediaMetadataSnapshot = Readonly<{
  id: string;
  originalName: string;
  translations: readonly MediaAltTranslation[];
  version: number;
}>;

export type MediaMetadataUpdate = Readonly<{
  originalName?: string;
  translations?: readonly MediaAltTranslation[];
}>;

export class MediaUpdateRepositoryConflictError extends Error {
  constructor() {
    super("media_update_conflict");
    this.name = "MediaUpdateRepositoryConflictError";
  }
}

export interface MediaUpdateRepository {
  findMetadata(id: string): Promise<MediaMetadataSnapshot | null>;
  saveMetadata(
    snapshot: MediaMetadataSnapshot,
    update: MediaMetadataUpdate,
    actorId: string,
  ): Promise<MediaMetadataSnapshot | null>;
}

function snapshot(document: {
  _id: Types.ObjectId;
  originalName: string;
  translations: MediaAltTranslation[];
  get(path: string): unknown;
}): MediaMetadataSnapshot {
  const version = document.get("__v");
  if (!Number.isSafeInteger(version) || Number(version) < 0) {
    throw new TypeError("Media document has an invalid version.");
  }
  return {
    id: document._id.toString(),
    originalName: document.originalName,
    translations: document.translations.map((translation) => ({
      locale: translation.locale,
      alt: translation.alt,
    })),
    version: Number(version),
  };
}

function isVersionError(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && "name" in error && error.name === "VersionError"
  );
}

export function createMediaUpdateRepository(connection: Connection): MediaUpdateRepository {
  const Media = getMediaModel(connection);
  return {
    async findMetadata(id) {
      if (!Types.ObjectId.isValid(id)) return null;
      const document = await Media.findOne({ _id: new Types.ObjectId(id), deletedAt: null });
      return document ? snapshot(document) : null;
    },
    async saveMetadata(current, update, actorId) {
      const document = await Media.findOne({
        _id: new Types.ObjectId(current.id),
        deletedAt: null,
      });
      if (!document) return null;
      if (document.get("__v") !== current.version) {
        throw new MediaUpdateRepositoryConflictError();
      }
      if (update.originalName !== undefined) document.originalName = update.originalName;
      if (update.translations !== undefined) {
        document.set(
          "translations",
          update.translations.map((translation) => ({ ...translation })),
        );
      }
      document.updatedBy = createActorMetadata("admin", actorId);
      try {
        await document.save();
      } catch (error) {
        if (isVersionError(error)) throw new MediaUpdateRepositoryConflictError();
        throw error;
      }
      return snapshot(document);
    },
  };
}
