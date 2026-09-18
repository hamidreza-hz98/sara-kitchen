import "server-only";

import { Types } from "mongoose";
import type { Connection } from "mongoose";

import { createActorMetadata } from "@/server/database/schema";

import { getCategoryModel, type CategoryStatus, type CategoryTranslation } from "../model/category";

export type CategorySnapshot = Readonly<{
  id: string;
  translations: readonly CategoryTranslation[];
  slug: string;
  bannerMediaId: string | null;
  imageMediaId: string | null;
  seoPageId: string | null;
  status: CategoryStatus;
  sortOrder: number;
  deletedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}>;

export type CategoryWrite = Readonly<{
  translations: readonly CategoryTranslation[];
  slug: string;
  bannerMediaId: string | null;
  imageMediaId: string | null;
  status: CategoryStatus;
  sortOrder: number;
}>;

export type CategoryListOptions = Readonly<{
  page: number;
  pageSize: number;
  status?: CategoryStatus;
  search?: string;
}>;

export type CategoryListResult = Readonly<{
  items: readonly CategorySnapshot[];
  total: number;
}>;

export class CategoryRepositoryConflictError extends Error {
  constructor() {
    super("category_conflict");
    this.name = "CategoryRepositoryConflictError";
  }
}

export interface CategoryRepository {
  findById(id: string, includeDeleted?: boolean): Promise<CategorySnapshot | null>;
  findBySlug(slug: string): Promise<CategorySnapshot | null>;
  list(options: CategoryListOptions): Promise<CategoryListResult>;
  isSlugTaken(slug: string, excludingId?: string): Promise<boolean>;
  create(value: CategoryWrite, actorId: string): Promise<CategorySnapshot>;
  save(current: CategorySnapshot, value: CategoryWrite, actorId: string): Promise<CategorySnapshot>;
  setSeoPageId(
    current: CategorySnapshot,
    seoPageId: string,
    actorId: string,
  ): Promise<CategorySnapshot>;
  softDelete(current: CategorySnapshot, actorId: string, now: Date): Promise<CategorySnapshot>;
  restore(current: CategorySnapshot, actorId: string): Promise<CategorySnapshot>;
}

function snapshot(document: InstanceType<ReturnType<typeof getCategoryModel>>): CategorySnapshot {
  return {
    id: document._id.toHexString(),
    translations: document.translations.map((entry) => ({
      locale: entry.locale,
      name: entry.name,
      description: entry.description,
    })),
    slug: document.slug,
    bannerMediaId: document.bannerMediaId?.toHexString() ?? null,
    imageMediaId: document.imageMediaId?.toHexString() ?? null,
    seoPageId: document.seoPageId?.toHexString() ?? null,
    status: document.status,
    sortOrder: document.sortOrder,
    deletedAt: document.deletedAt?.toISOString() ?? null,
    version: Number(document.get("__v") ?? 0),
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

function isDuplicateOrVersion(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (("code" in error && error.code === 11000) ||
      ("name" in error && error.name === "VersionError"))
  );
}

function applyWrite(
  document: InstanceType<ReturnType<typeof getCategoryModel>>,
  value: CategoryWrite,
) {
  document.translations = value.translations.map((entry) => ({ ...entry }));
  document.slug = value.slug;
  document.bannerMediaId = value.bannerMediaId ? new Types.ObjectId(value.bannerMediaId) : null;
  document.imageMediaId = value.imageMediaId ? new Types.ObjectId(value.imageMediaId) : null;
  document.status = value.status;
  document.sortOrder = value.sortOrder;
}

export function createCategoryRepository(connection: Connection): CategoryRepository {
  const Category = getCategoryModel(connection);
  const load = async (current: CategorySnapshot) => {
    const document = await Category.findById(current.id);
    if (!document) throw new CategoryRepositoryConflictError();
    if (document.get("__v") !== current.version) throw new CategoryRepositoryConflictError();
    return document;
  };

  return {
    async findById(id, includeDeleted = false) {
      if (!Types.ObjectId.isValid(id)) return null;
      const document = await Category.findOne({
        _id: new Types.ObjectId(id),
        ...(!includeDeleted ? { deletedAt: null } : {}),
      });
      return document ? snapshot(document) : null;
    },
    async findBySlug(slug) {
      const document = await Category.findOne({ slug, deletedAt: null });
      return document ? snapshot(document) : null;
    },
    async list(options) {
      const filter: Record<string, unknown> = { deletedAt: null };
      if (options.status) filter.status = options.status;
      if (options.search) filter.$text = { $search: options.search };
      const [documents, total] = await Promise.all([
        Category.find(filter)
          .sort({ sortOrder: 1, _id: 1 })
          .skip((options.page - 1) * options.pageSize)
          .limit(options.pageSize),
        Category.countDocuments(filter),
      ]);
      return { items: documents.map(snapshot), total };
    },
    async isSlugTaken(slug, excludingId) {
      return Boolean(
        await Category.exists({
          slug,
          ...(excludingId ? { _id: { $ne: new Types.ObjectId(excludingId) } } : {}),
        }),
      );
    },
    async create(value, actorId) {
      const document = new Category();
      applyWrite(document, value);
      document.createdBy = createActorMetadata("admin", actorId);
      document.updatedBy = createActorMetadata("admin", actorId);
      try {
        await document.save();
      } catch (error) {
        if (isDuplicateOrVersion(error)) throw new CategoryRepositoryConflictError();
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
        if (isDuplicateOrVersion(error)) throw new CategoryRepositoryConflictError();
        throw error;
      }
      return snapshot(document);
    },
    async setSeoPageId(current, seoPageId, actorId) {
      const document = await load(current);
      document.seoPageId = new Types.ObjectId(seoPageId);
      document.updatedBy = createActorMetadata("admin", actorId);
      await document.save();
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
      await document.save();
      return snapshot(document);
    },
  };
}
