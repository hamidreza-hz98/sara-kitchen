import "server-only";

import { Types } from "mongoose";
import type { Connection } from "mongoose";

import { createActorMetadata } from "@/server/database/schema";

import {
  SETTINGS_SECTION_REGISTRY,
  getSettingsSectionModel,
  type SettingsJsonObject,
  type SettingsRevision,
  type SettingsSectionKey,
} from "../model/settings-section";

export type MutableSettingsSectionKey = Exclude<SettingsSectionKey, "terms">;

export type SettingsPayloadEnvelope = Readonly<{
  data: SettingsJsonObject;
  translations: readonly Readonly<{
    locale: "en" | "pt-PT" | "fa";
    value: SettingsJsonObject;
  }>[];
}>;

export type SettingsRevisionSnapshot = Readonly<{
  payload: SettingsPayloadEnvelope;
  revision: number;
  editedByAdminId: string;
  editedAt: string;
  publishedAt: string | null;
}>;

export type SettingsSectionSnapshot = Readonly<{
  id: string;
  key: MutableSettingsSectionKey;
  publicationPolicy: "direct" | "staged";
  draft: SettingsRevisionSnapshot | null;
  published: SettingsRevisionSnapshot | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}>;

export class SettingsRepositoryConflictError extends Error {
  constructor() {
    super("settings_conflict");
    this.name = "SettingsRepositoryConflictError";
  }
}

export interface SettingsSectionRepository {
  findByKey(key: MutableSettingsSectionKey): Promise<SettingsSectionSnapshot | null>;
  saveDraft(
    current: SettingsSectionSnapshot | null,
    key: MutableSettingsSectionKey,
    payload: SettingsPayloadEnvelope,
    actorId: string,
    now: Date,
  ): Promise<SettingsSectionSnapshot>;
  saveDirect(
    current: SettingsSectionSnapshot | null,
    key: MutableSettingsSectionKey,
    payload: SettingsPayloadEnvelope,
    actorId: string,
    now: Date,
  ): Promise<SettingsSectionSnapshot>;
  publishDraft(
    current: SettingsSectionSnapshot,
    actorId: string,
    now: Date,
  ): Promise<SettingsSectionSnapshot>;
}

type SettingsDocument = InstanceType<ReturnType<typeof getSettingsSectionModel>>;

function revisionSnapshot(revision: SettingsRevision | null): SettingsRevisionSnapshot | null {
  if (!revision) return null;
  return {
    payload: {
      data: structuredClone(revision.data),
      translations: revision.translations.map(({ locale, value }) => ({
        locale,
        value: structuredClone(value),
      })),
    },
    revision: revision.revision,
    editedByAdminId: revision.editedByAdminId.toHexString(),
    editedAt: revision.editedAt.toISOString(),
    publishedAt: revision.publishedAt?.toISOString() ?? null,
  };
}

function snapshot(document: SettingsDocument): SettingsSectionSnapshot {
  if (document.key === "terms") {
    throw new TypeError("Legal policies are owned by the immutable policy lifecycle.");
  }
  return {
    id: document._id.toHexString(),
    key: document.key,
    publicationPolicy: document.publicationPolicy,
    draft: revisionSnapshot(document.draft),
    published: revisionSnapshot(document.published),
    version: Number(document.get("__v") ?? 0),
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

function isConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (("code" in error && error.code === 11_000) ||
      ("name" in error && error.name === "VersionError"))
  );
}

function nextRevision(current: SettingsSectionSnapshot | null): number {
  return Math.max(current?.draft?.revision ?? 0, current?.published?.revision ?? 0) + 1;
}

function revision(
  number: number,
  payload: SettingsPayloadEnvelope,
  actorId: string,
  now: Date,
  published: boolean,
): SettingsRevision {
  return {
    revision: number,
    data: structuredClone(payload.data),
    translations: payload.translations.map(({ locale, value }) => ({
      locale,
      value: structuredClone(value),
    })),
    editedByAdminId: new Types.ObjectId(actorId),
    editedAt: now,
    publishedAt: published ? now : null,
  };
}

export function createSettingsSectionRepository(connection: Connection): SettingsSectionRepository {
  const Settings = getSettingsSectionModel(connection);

  async function load(current: SettingsSectionSnapshot): Promise<SettingsDocument> {
    const document = await Settings.findById(current.id);
    if (!document || document.get("__v") !== current.version) {
      throw new SettingsRepositoryConflictError();
    }
    return document;
  }

  async function save(document: SettingsDocument): Promise<SettingsSectionSnapshot> {
    try {
      await document.save();
    } catch (error) {
      if (isConflict(error)) throw new SettingsRepositoryConflictError();
      throw error;
    }
    return snapshot(document);
  }

  function create(key: MutableSettingsSectionKey, actorId: string): SettingsDocument {
    const document = new Settings({
      key,
      publicationPolicy: SETTINGS_SECTION_REGISTRY[key].publicationPolicy,
      draft: null,
      published: null,
    });
    document.createdBy = createActorMetadata("admin", actorId);
    document.updatedBy = createActorMetadata("admin", actorId);
    return document;
  }

  return {
    async findByKey(key) {
      const document = await Settings.findOne({ key });
      return document ? snapshot(document) : null;
    },
    async saveDraft(current, key, payload, actorId, now) {
      if (SETTINGS_SECTION_REGISTRY[key].publicationPolicy !== "staged") {
        throw new TypeError("Direct settings cannot contain drafts.");
      }
      const document = current ? await load(current) : create(key, actorId);
      document.draft = revision(nextRevision(current), payload, actorId, now, false);
      document.updatedBy = createActorMetadata("admin", actorId);
      return save(document);
    },
    async saveDirect(current, key, payload, actorId, now) {
      if (SETTINGS_SECTION_REGISTRY[key].publicationPolicy !== "direct") {
        throw new TypeError("Staged settings must be published explicitly.");
      }
      const document = current ? await load(current) : create(key, actorId);
      document.draft = null;
      document.published = revision(nextRevision(current), payload, actorId, now, true);
      document.updatedBy = createActorMetadata("admin", actorId);
      return save(document);
    },
    async publishDraft(current, actorId, now) {
      if (!current.draft || current.publicationPolicy !== "staged") {
        throw new SettingsRepositoryConflictError();
      }
      const document = await load(current);
      if (!document.draft) throw new SettingsRepositoryConflictError();
      document.published = {
        revision: document.draft.revision,
        data: structuredClone(document.draft.data),
        translations: document.draft.translations.map(({ locale, value }) => ({
          locale,
          value: structuredClone(value),
        })),
        editedByAdminId: document.draft.editedByAdminId,
        editedAt: document.draft.editedAt,
        publishedAt: now,
      };
      document.draft = null;
      document.updatedBy = createActorMetadata("admin", actorId);
      return save(document);
    },
  };
}
