import "server-only";

import { Types } from "mongoose";
import type { Connection } from "mongoose";

import { createActorMetadata, normalizeSearchText } from "@/server/database/schema";

import {
  getBlogModel,
  type BlogAuthorSnapshot,
  type BlogStatus,
  type BlogTranslation,
} from "../model/blog";

export type BlogSnapshot = Readonly<{
  id: string;
  translations: readonly BlogTranslation[];
  slug: string;
  imageMediaId: string | null;
  bannerMediaId: string | null;
  readTimeMinutes: number;
  authorAdminId: string;
  authorSnapshot: BlogAuthorSnapshot;
  status: BlogStatus;
  publishAt: string | null;
  publishedAt: string | null;
  tags: readonly string[];
  relatedDishIds: readonly string[];
  relatedBlogIds: readonly string[];
  viewCount: number;
  seoPageId: string | null;
  deletedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}>;

export type BlogWrite = Readonly<{
  translations: readonly BlogTranslation[];
  slug: string;
  imageMediaId: string | null;
  bannerMediaId: string | null;
  readTimeMinutes: number;
  authorAdminId: string;
  authorSnapshot: BlogAuthorSnapshot;
  status: BlogStatus;
  publishAt: Date | null;
  publishedAt: Date | null;
  tags: readonly string[];
  relatedDishIds: readonly string[];
  relatedBlogIds: readonly string[];
}>;

export type BlogListOptions = Readonly<{
  page: number;
  pageSize: number;
  status?: BlogStatus;
  authorAdminId?: string;
  search?: string;
  sortBy?: "createdAt" | "publishedAt" | "publishAt" | "status" | "title" | "viewCount";
  sortDirection?: "asc" | "desc";
}>;

export type BlogListResult = Readonly<{ items: readonly BlogSnapshot[]; total: number }>;

export class BlogRepositoryConflictError extends Error {
  constructor() {
    super("blog_conflict");
    this.name = "BlogRepositoryConflictError";
  }
}

export interface BlogRepository {
  findById(id: string): Promise<BlogSnapshot | null>;
  findBySlug(slug: string, publishedOnly?: boolean): Promise<BlogSnapshot | null>;
  list(options: BlogListOptions): Promise<BlogListResult>;
  listPublic(options: Omit<BlogListOptions, "status" | "authorAdminId">): Promise<BlogListResult>;
  isSlugTaken(slug: string, excludingId?: string): Promise<boolean>;
  wouldCreateRelationshipCycle(blogId: string, relatedBlogIds: readonly string[]): Promise<boolean>;
  create(value: BlogWrite, actorId: string): Promise<BlogSnapshot>;
  save(current: BlogSnapshot, value: BlogWrite, actorId: string): Promise<BlogSnapshot>;
  setSeoPageId(current: BlogSnapshot, seoPageId: string, actorId: string): Promise<BlogSnapshot>;
  rollbackCreate(current: BlogSnapshot): Promise<boolean>;
  removeInboundRelationships(blogId: string, actorId: string): Promise<readonly string[]>;
  publishDue(at: Date): Promise<readonly BlogSnapshot[]>;
}

type BlogDocument = InstanceType<ReturnType<typeof getBlogModel>>;

function snapshot(document: BlogDocument): BlogSnapshot {
  return {
    id: document._id.toHexString(),
    translations: document.translations.map((translation) => ({
      ...translation,
      content: structuredClone(translation.content),
    })),
    slug: document.slug,
    imageMediaId: document.imageMediaId?.toHexString() ?? null,
    bannerMediaId: document.bannerMediaId?.toHexString() ?? null,
    readTimeMinutes: document.readTimeMinutes,
    authorAdminId: document.authorAdminId.toHexString(),
    authorSnapshot: { ...document.authorSnapshot },
    status: document.status,
    publishAt: document.publishAt?.toISOString() ?? null,
    publishedAt: document.publishedAt?.toISOString() ?? null,
    tags: [...document.tags],
    relatedDishIds: document.relatedDishIds.map((id) => id.toHexString()),
    relatedBlogIds: document.relatedBlogIds.map((id) => id.toHexString()),
    viewCount: document.viewCount,
    seoPageId: document.seoPageId?.toHexString() ?? null,
    deletedAt: document.deletedAt?.toISOString() ?? null,
    version: Number(document.get("__v") ?? 0),
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

function ids(values: readonly string[]): Types.ObjectId[] {
  return values.map((value) => new Types.ObjectId(value));
}

function date(value: string | null): Date | null {
  return value ? new Date(value) : null;
}

function applyWrite(document: BlogDocument, value: BlogWrite): void {
  document.translations = value.translations.map((translation) => ({
    ...translation,
    content: structuredClone(translation.content),
  }));
  document.slug = value.slug;
  document.imageMediaId = value.imageMediaId ? new Types.ObjectId(value.imageMediaId) : null;
  document.bannerMediaId = value.bannerMediaId ? new Types.ObjectId(value.bannerMediaId) : null;
  document.readTimeMinutes = value.readTimeMinutes;
  document.authorAdminId = new Types.ObjectId(value.authorAdminId);
  document.authorSnapshot = { ...value.authorSnapshot };
  document.status = value.status;
  document.publishAt = value.publishAt;
  if (value.publishedAt && !document.publishedAt) document.publishedAt = value.publishedAt;
  document.tags = [...value.tags];
  document.relatedDishIds = ids(value.relatedDishIds);
  document.relatedBlogIds = ids(value.relatedBlogIds);
}

function conflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (("code" in error && error.code === 11_000) ||
      ("name" in error && error.name === "VersionError"))
  );
}

export function createBlogRepository(connection: Connection): BlogRepository {
  const Blog = getBlogModel(connection);
  const load = async (current: BlogSnapshot) => {
    const document = await Blog.findById(current.id);
    if (!document || document.get("__v") !== current.version) {
      throw new BlogRepositoryConflictError();
    }
    return document;
  };

  const listWithFilter = async (
    options: BlogListOptions,
    initial: Record<string, unknown>,
  ): Promise<BlogListResult> => {
    const filter: Record<string, unknown> = { ...initial };
    if (options.status) filter.status = options.status;
    if (options.authorAdminId) filter.authorAdminId = new Types.ObjectId(options.authorAdminId);
    if (options.search) {
      filter.normalizedSearchText = { $regex: normalizeSearchText(options.search) };
    }
    const sortBy =
      options.sortBy === "title" ? "normalizedSearchText" : (options.sortBy ?? "createdAt");
    const direction = options.sortDirection === "asc" ? 1 : -1;
    const [documents, total] = await Promise.all([
      Blog.find(filter)
        .sort({ [sortBy]: direction, _id: direction })
        .skip((options.page - 1) * options.pageSize)
        .limit(options.pageSize),
      Blog.countDocuments(filter),
    ]);
    return { items: documents.map(snapshot), total };
  };

  return {
    async findById(id) {
      if (!Types.ObjectId.isValid(id)) return null;
      const document = await Blog.findOne({ _id: id, deletedAt: null });
      return document ? snapshot(document) : null;
    },
    async findBySlug(slug, publishedOnly = false) {
      const document = await Blog.findOne({
        slug,
        deletedAt: null,
        ...(publishedOnly ? { status: "published" } : {}),
      });
      return document ? snapshot(document) : null;
    },
    list(options) {
      return listWithFilter(options, { deletedAt: null });
    },
    listPublic(options) {
      return listWithFilter(options, { deletedAt: null, status: "published" });
    },
    async isSlugTaken(slug, excludingId) {
      return Boolean(
        await Blog.exists({
          slug,
          ...(excludingId && Types.ObjectId.isValid(excludingId)
            ? { _id: { $ne: new Types.ObjectId(excludingId) } }
            : {}),
        }),
      );
    },
    async wouldCreateRelationshipCycle(blogId, relatedBlogIds) {
      if (!Types.ObjectId.isValid(blogId)) return true;
      const target = blogId.toLowerCase();
      let frontier = [...relatedBlogIds];
      const visited = new Set<string>();
      while (frontier.length > 0) {
        if (frontier.some((id) => id.toLowerCase() === target)) return true;
        const next = frontier.filter((id) => !visited.has(id));
        if (next.length === 0) return false;
        next.forEach((id) => visited.add(id));
        if (visited.size > 10_000) return true;
        const records = await Blog.find({
          _id: { $in: ids(next) },
          deletedAt: null,
          status: { $ne: "archived" },
        }).select({ relatedBlogIds: 1 });
        frontier = records.flatMap((record) => record.relatedBlogIds.map((id) => id.toHexString()));
      }
      return false;
    },
    async create(value, actorId) {
      const document = new Blog();
      applyWrite(document, value);
      document.createdBy = createActorMetadata("admin", actorId);
      document.updatedBy = createActorMetadata("admin", actorId);
      try {
        await document.save();
      } catch (error) {
        if (conflict(error)) throw new BlogRepositoryConflictError();
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
        if (conflict(error)) throw new BlogRepositoryConflictError();
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
    async rollbackCreate(current) {
      const result = await Blog.deleteOne({
        _id: new Types.ObjectId(current.id),
        __v: current.version,
        seoPageId: null,
      });
      return result.deletedCount === 1;
    },
    async removeInboundRelationships(blogId, actorId) {
      const id = new Types.ObjectId(blogId);
      const affected = await Blog.find({ deletedAt: null, relatedBlogIds: id }).select({ _id: 1 });
      if (affected.length > 0) {
        await Blog.updateMany(
          { _id: { $in: affected.map((item) => item._id) } },
          {
            $pull: { relatedBlogIds: id },
            $set: { updatedBy: createActorMetadata("admin", actorId) },
          },
          { timestamps: true },
        );
      }
      return affected.map((item) => item._id.toHexString());
    },
    async publishDue(at) {
      const due = await Blog.find({
        deletedAt: null,
        status: "scheduled",
        publishAt: { $lte: at },
      });
      const published: BlogSnapshot[] = [];
      for (const document of due) {
        const firstPublishedAt = document.publishedAt ?? at;
        const result = await Blog.updateOne(
          {
            _id: document._id,
            __v: document.get("__v"),
            status: "scheduled",
            publishAt: { $lte: at },
          },
          {
            $set: {
              status: "published",
              publishAt: null,
              publishedAt: firstPublishedAt,
              updatedBy: createActorMetadata("system"),
            },
            $inc: { __v: 1 },
          },
          { timestamps: true, runValidators: true },
        );
        if (result.modifiedCount === 1) {
          const updated = await Blog.findById(document._id);
          if (updated) published.push(snapshot(updated));
        }
      }
      return published;
    },
  };
}

export function blogWriteFromSnapshot(value: BlogSnapshot): BlogWrite {
  return {
    translations: value.translations,
    slug: value.slug,
    imageMediaId: value.imageMediaId,
    bannerMediaId: value.bannerMediaId,
    readTimeMinutes: value.readTimeMinutes,
    authorAdminId: value.authorAdminId,
    authorSnapshot: value.authorSnapshot,
    status: value.status,
    publishAt: date(value.publishAt),
    publishedAt: date(value.publishedAt),
    tags: value.tags,
    relatedDishIds: value.relatedDishIds,
    relatedBlogIds: value.relatedBlogIds,
  };
}
