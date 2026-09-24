import "server-only";

import type { Connection } from "mongoose";

import { createBlogRepository, type BlogSnapshot } from "@/server/modules/blogs";
import { createCategoryRepository, type CategorySnapshot } from "@/server/modules/categories";
import { createDishRepository, type DishSnapshot } from "@/server/modules/dishes";
import { getMediaReferenceFacts, type MediaReferenceFacts } from "@/server/modules/media";

import type { HomepageSettingsData } from "../validation/homepage-settings";

export const HOMEPAGE_REFERENCE_ERROR_CODES = [
  "missing",
  "archived",
  "unpublished",
  "unavailable",
  "wrong_media_kind",
  "media_not_ready",
] as const;

export type HomepageReferenceErrorCode = (typeof HOMEPAGE_REFERENCE_ERROR_CODES)[number];
export type HomepageReferenceKind = "media" | "dish" | "category" | "blog";
export type HomepageReferenceIssue = Readonly<{
  code: HomepageReferenceErrorCode;
  id: string;
  kind: HomepageReferenceKind;
}>;
export type HomepageReferenceValidationMode = "draft" | "publish";

export type HomepageReferenceDependencies = Readonly<{
  getMedia(ids: readonly string[]): Promise<readonly MediaReferenceFacts[]>;
  getDish(id: string): Promise<DishSnapshot | null>;
  getCategory(id: string): Promise<CategorySnapshot | null>;
  getBlog(id: string): Promise<BlogSnapshot | null>;
}>;

export class HomepageSettingsReferenceError extends Error {
  readonly issues: readonly HomepageReferenceIssue[];

  constructor(issues: readonly HomepageReferenceIssue[]) {
    super("homepage_invalid_references");
    this.name = "HomepageSettingsReferenceError";
    this.issues = issues;
  }
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function mediaIds(data: HomepageSettingsData): string[] {
  return unique([
    ...data.heroSlides.flatMap(({ imageMediaId, mobileImageMediaId }) =>
      mobileImageMediaId ? [imageMediaId, mobileImageMediaId] : [imageMediaId],
    ),
    ...data.linkedBanners.map(({ imageMediaId }) => imageMediaId),
    ...data.benefits.flatMap(({ iconMediaId }) => (iconMediaId ? [iconMediaId] : [])),
    ...data.testimonials.flatMap(({ avatarMediaId }) => (avatarMediaId ? [avatarMediaId] : [])),
    ...data.categoryBanners.flatMap(({ imageMediaId }) => (imageMediaId ? [imageMediaId] : [])),
  ]);
}

export async function validateHomepageSettingsReferences(
  data: HomepageSettingsData,
  dependencies: HomepageReferenceDependencies,
  mode: HomepageReferenceValidationMode,
): Promise<void> {
  const requestedMediaIds = mediaIds(data);
  const dishIds = unique([...data.featuredDishIds, ...data.discountedSection.dishIds]);
  const categoryIds = unique(data.categoryBanners.map(({ categoryId }) => categoryId));
  const blogIds = unique(data.blogIds);
  const [media, dishes, categories, blogs] = await Promise.all([
    dependencies.getMedia(requestedMediaIds),
    Promise.all(dishIds.map((id) => dependencies.getDish(id))),
    Promise.all(categoryIds.map((id) => dependencies.getCategory(id))),
    Promise.all(blogIds.map((id) => dependencies.getBlog(id))),
  ]);
  const issues: HomepageReferenceIssue[] = [];
  const mediaById = new Map(media.map((item) => [item.id, item]));
  for (const id of requestedMediaIds) {
    const item = mediaById.get(id);
    if (!item) issues.push({ code: "missing", id, kind: "media" });
    else if (item.kind !== "image") issues.push({ code: "wrong_media_kind", id, kind: "media" });
    else if (item.processingState !== "ready") {
      issues.push({ code: "media_not_ready", id, kind: "media" });
    }
  }

  for (const [index, id] of dishIds.entries()) {
    const item = dishes[index];
    if (!item || item.deletedAt) issues.push({ code: "missing", id, kind: "dish" });
    else if (item.status === "archived") issues.push({ code: "archived", id, kind: "dish" });
    else if (mode === "publish" && item.status !== "published") {
      issues.push({ code: "unpublished", id, kind: "dish" });
    } else if (mode === "publish" && item.availability.mode === "unavailable") {
      issues.push({ code: "unavailable", id, kind: "dish" });
    }
  }
  for (const [index, id] of categoryIds.entries()) {
    const item = categories[index];
    if (!item || item.deletedAt) issues.push({ code: "missing", id, kind: "category" });
    else if (item.status === "archived") issues.push({ code: "archived", id, kind: "category" });
    else if (mode === "publish" && item.status !== "published") {
      issues.push({ code: "unpublished", id, kind: "category" });
    }
  }
  for (const [index, id] of blogIds.entries()) {
    const item = blogs[index];
    if (!item || item.deletedAt) issues.push({ code: "missing", id, kind: "blog" });
    else if (item.status === "archived") issues.push({ code: "archived", id, kind: "blog" });
    else if (mode === "publish" && item.status !== "published") {
      issues.push({ code: "unpublished", id, kind: "blog" });
    }
  }
  if (issues.length > 0) throw new HomepageSettingsReferenceError(issues);
}

export function createHomepageReferenceDependencies(
  connection: Connection,
): HomepageReferenceDependencies {
  const dishes = createDishRepository(connection);
  const categories = createCategoryRepository(connection);
  const blogs = createBlogRepository(connection);
  return {
    getMedia: (ids) => getMediaReferenceFacts(connection, ids),
    getDish: (id) => dishes.findById(id, true),
    getCategory: (id) => categories.findById(id, true),
    getBlog: (id) => blogs.findById(id),
  };
}
