import "server-only";

import { Types } from "mongoose";
import type { Connection } from "mongoose";

import { escapeSearchPattern } from "@/server/database";
import { createActorMetadata, normalizeSearchText } from "@/server/database/schema";

import {
  getIngredientModel,
  type IngredientAllergenTag,
  type IngredientStatus,
  type IngredientTranslation,
} from "../model/ingredient";

export type IngredientSnapshot = Readonly<{
  id: string;
  translations: readonly IngredientTranslation[];
  imageMediaId: string | null;
  allergenTags: readonly IngredientAllergenTag[];
  status: IngredientStatus;
  deletedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}>;

export type IngredientWrite = Readonly<{
  translations: readonly IngredientTranslation[];
  imageMediaId: string | null;
  allergenTags: readonly IngredientAllergenTag[];
  status: IngredientStatus;
}>;

export type IngredientListOptions = Readonly<{
  page: number;
  pageSize: number;
  status?: IngredientStatus;
  allergen?: IngredientAllergenTag;
  search?: string;
  sortBy?: "name" | "createdAt" | "status";
  sortDirection?: "asc" | "desc";
}>;

export type IngredientListResult = Readonly<{
  items: readonly IngredientSnapshot[];
  total: number;
}>;

export class IngredientRepositoryConflictError extends Error {
  constructor() {
    super("ingredient_conflict");
    this.name = "IngredientRepositoryConflictError";
  }
}

export interface IngredientRepository {
  findById(id: string, includeDeleted?: boolean): Promise<IngredientSnapshot | null>;
  list(options: IngredientListOptions): Promise<IngredientListResult>;
  isCanonicalNameTaken(name: string, excludingId?: string): Promise<boolean>;
  create(value: IngredientWrite, actorId: string): Promise<IngredientSnapshot>;
  save(
    current: IngredientSnapshot,
    value: IngredientWrite,
    actorId: string,
  ): Promise<IngredientSnapshot>;
  softDelete(current: IngredientSnapshot, actorId: string, now: Date): Promise<IngredientSnapshot>;
  restore(current: IngredientSnapshot, actorId: string): Promise<IngredientSnapshot>;
}

function snapshot(
  document: InstanceType<ReturnType<typeof getIngredientModel>>,
): IngredientSnapshot {
  return {
    id: document._id.toHexString(),
    translations: document.translations.map((entry) => ({
      locale: entry.locale,
      name: entry.name,
    })),
    imageMediaId: document.imageMediaId?.toHexString() ?? null,
    allergenTags: [...document.allergenTags],
    status: document.status,
    deletedAt: document.deletedAt?.toISOString() ?? null,
    version: Number(document.get("__v") ?? 0),
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

function isConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (("code" in error && error.code === 11000) ||
      ("name" in error && error.name === "VersionError"))
  );
}

function applyWrite(
  document: InstanceType<ReturnType<typeof getIngredientModel>>,
  value: IngredientWrite,
) {
  document.translations = value.translations.map((entry) => ({ ...entry }));
  document.imageMediaId = value.imageMediaId ? new Types.ObjectId(value.imageMediaId) : null;
  document.allergenTags = [...value.allergenTags];
  document.status = value.status;
}

export function createIngredientRepository(connection: Connection): IngredientRepository {
  const Ingredient = getIngredientModel(connection);
  const load = async (current: IngredientSnapshot) => {
    const document = await Ingredient.findById(current.id);
    if (!document || document.get("__v") !== current.version) {
      throw new IngredientRepositoryConflictError();
    }
    return document;
  };
  return {
    async findById(id, includeDeleted = false) {
      if (!Types.ObjectId.isValid(id)) return null;
      const document = await Ingredient.findOne({
        _id: new Types.ObjectId(id),
        ...(!includeDeleted ? { deletedAt: null } : {}),
      });
      return document ? snapshot(document) : null;
    },
    async list(options) {
      const filter: Record<string, unknown> = { deletedAt: null };
      if (options.status) filter.status = options.status;
      if (options.allergen) filter.allergenTags = options.allergen;
      if (options.search) {
        filter.normalizedSearchText = {
          $regex: escapeSearchPattern(normalizeSearchText(options.search)),
        };
      }
      const sortBy =
        options.sortBy === "name" ? "canonicalNameKey" : (options.sortBy ?? "canonicalNameKey");
      const direction = options.sortDirection === "desc" ? -1 : 1;
      const [documents, total] = await Promise.all([
        Ingredient.find(filter)
          .sort({ [sortBy]: direction, _id: direction })
          .skip((options.page - 1) * options.pageSize)
          .limit(options.pageSize),
        Ingredient.countDocuments(filter),
      ]);
      return { items: documents.map(snapshot), total };
    },
    async isCanonicalNameTaken(name, excludingId) {
      return Boolean(
        await Ingredient.exists({
          canonicalNameKey: normalizeSearchText(name),
          deletedAt: null,
          ...(excludingId && Types.ObjectId.isValid(excludingId)
            ? { _id: { $ne: new Types.ObjectId(excludingId) } }
            : {}),
        }),
      );
    },
    async create(value, actorId) {
      const document = new Ingredient();
      applyWrite(document, value);
      document.createdBy = createActorMetadata("admin", actorId);
      document.updatedBy = createActorMetadata("admin", actorId);
      try {
        await document.save();
      } catch (error) {
        if (isConflict(error)) throw new IngredientRepositoryConflictError();
        throw error;
      }
      return snapshot(document);
    },
    async save(current, value, actorId) {
      const document = await load(current);
      applyWrite(document, value);
      document.updatedBy = createActorMetadata("admin", actorId);
      try {
        await document.save();
      } catch (error) {
        if (isConflict(error)) throw new IngredientRepositoryConflictError();
        throw error;
      }
      return snapshot(document);
    },
    async softDelete(current, actorId, now) {
      const document = await load(current);
      document.deletedAt = now;
      document.deletedBy = createActorMetadata("admin", actorId);
      document.updatedBy = createActorMetadata("admin", actorId);
      await document.save();
      return snapshot(document);
    },
    async restore(current, actorId) {
      const document = await load(current);
      document.deletedAt = null;
      document.deletedBy = null;
      document.updatedBy = createActorMetadata("admin", actorId);
      try {
        await document.save();
      } catch (error) {
        if (isConflict(error)) throw new IngredientRepositoryConflictError();
        throw error;
      }
      return snapshot(document);
    },
  };
}
