import "server-only";

import { z } from "zod";

import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale } from "@/constants";
import { hasAdminPermission, type AdminRole } from "@/constants/admin-access";
import { resolveLocalizedValue } from "@/locales/translation-selection";
import { tagsForContentChange, type CacheTag } from "@/server/cache";
import { validateTranslationValues } from "@/server/database/schema";
import { isStoredRichText } from "@/lib/rich-text";
import { resolveUniqueSlug, SLUG_PATTERN } from "@/server/slugs";

import {
  BLOG_MAX_READ_TIME_MINUTES,
  BLOG_MAX_RELATIONS,
  BLOG_MAX_TAGS,
  type BlogTranslation,
} from "../model/blog";
import { issueBlogPreviewToken, verifyBlogPreviewToken } from "../policy/preview-token";
import {
  BlogRepositoryConflictError,
  blogWriteFromSnapshot,
  type BlogListOptions,
  type BlogRepository,
  type BlogSnapshot,
  type BlogWrite,
} from "../repository/blog";

export type BlogAction =
  "create" | "read" | "update" | "preview" | "schedule" | "publish" | "unpublish" | "archive";
export type BlogActor = Readonly<{ id: string; displayName: string; role: AdminRole }>;
export type BlogAuditEvent = Readonly<{
  action: BlogAction;
  outcome: "success" | "failure" | "denied";
  actorKind: "admin" | "system";
  actorId: string | null;
  blogId: string | null;
}>;

export type BlogReferenceIssue = Readonly<{
  kind: "banner_media" | "blog" | "dish" | "image_media";
  id: string;
}>;
export type BlogReferenceSet = Readonly<{
  bannerMediaId: string | null;
  imageMediaId: string | null;
  relatedBlogIds: readonly string[];
  relatedDishIds: readonly string[];
}>;
export type BlogReferenceInspection = Readonly<{
  archived: readonly BlogReferenceIssue[];
  missing: readonly BlogReferenceIssue[];
}>;
export type BlogSeoPort = Readonly<{ sync(blog: BlogSnapshot): Promise<string | null> }>;
export type BlogServiceDependencies = Readonly<{
  repository: BlogRepository;
  inspectReferences(references: BlogReferenceSet): Promise<BlogReferenceInspection>;
  seo: BlogSeoPort;
  removeInboundDishRelationships(blogId: string, actorId: string): Promise<readonly string[]>;
  audit(event: BlogAuditEvent): Promise<void>;
  invalidate(tag: CacheTag): void;
  previewSecret: string;
  now?: () => Date;
}>;

export type BlogInput = Readonly<{
  translations: readonly BlogTranslation[];
  slugOverride?: string | null;
  imageMediaId?: string | null;
  bannerMediaId?: string | null;
  readTimeMinutes?: number;
  tags?: readonly string[];
  relatedDishIds?: readonly string[];
  relatedBlogIds?: readonly string[];
}>;
export type BlogUpdate = Partial<BlogInput>;

export type BlogPublicItem = Readonly<{
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  resolvedLocale: SupportedLocale;
  direction: "ltr" | "rtl";
  imageMediaId: string | null;
  bannerMediaId: string | null;
  readTimeMinutes: number;
  author: string;
  publishedAt: string;
  tags: readonly string[];
  relatedDishIds: readonly string[];
  relatedBlogIds: readonly string[];
  viewCount: number;
}>;
export type BlogPublicDetail = BlogPublicItem & Readonly<{ content: BlogTranslation["content"] }>;

export class BlogServiceError extends Error {
  constructor(
    readonly code:
      | "forbidden"
      | "invalid_input"
      | "not_found"
      | "conflict"
      | "missing_reference"
      | "archived_reference"
      | "self_relationship"
      | "circular_relationship"
      | "invalid_transition"
      | "preview_denied",
    readonly issues: readonly BlogReferenceIssue[] = [],
  ) {
    super(code);
    this.name = "BlogServiceError";
  }
}

const objectId = z.string().regex(/^[a-f\d]{24}$/iu);
const translation = z.strictObject({
  locale: z.enum(SUPPORTED_LOCALES),
  title: z.string().trim().min(1).max(180),
  excerpt: z.string().trim().min(1).max(500),
  content: z.custom<BlogTranslation["content"]>(isStoredRichText),
});
const inputSchema = z.strictObject({
  translations: z.array(translation).min(1).max(SUPPORTED_LOCALES.length),
  slugOverride: z.string().trim().min(1).max(160).nullable().optional(),
  imageMediaId: objectId.nullable().optional(),
  bannerMediaId: objectId.nullable().optional(),
  readTimeMinutes: z.number().int().safe().min(1).max(BLOG_MAX_READ_TIME_MINUTES).optional(),
  tags: z.array(z.string().regex(SLUG_PATTERN)).max(BLOG_MAX_TAGS).optional(),
  relatedDishIds: z.array(objectId).max(BLOG_MAX_RELATIONS).optional(),
  relatedBlogIds: z.array(objectId).max(BLOG_MAX_RELATIONS).optional(),
});
const updateSchema = inputSchema.partial().refine((value) => Object.keys(value).length > 0);
const listSchema = z.strictObject({
  page: z.number().int().safe().min(1),
  pageSize: z.number().int().safe().min(1).max(100),
  status: z.enum(["draft", "scheduled", "published", "archived"]).optional(),
  authorAdminId: objectId.optional(),
  search: z.string().trim().min(2).max(80).optional(),
  sortBy: z
    .enum(["createdAt", "publishedAt", "publishAt", "status", "title", "viewCount"])
    .optional(),
  sortDirection: z.enum(["asc", "desc"]).optional(),
});

function canonicalTitle(translations: readonly BlogTranslation[]): string {
  const title = translations.find((item) => item.locale === "en")?.title;
  if (!title) throw new BlogServiceError("invalid_input");
  return title;
}

function unique(values: readonly string[]): boolean {
  return new Set(values.map((value) => value.toLowerCase())).size === values.length;
}

function validateInput(value: BlogInput): void {
  if (
    validateTranslationValues<BlogTranslation>(value.translations, {
      canonicalTextFields: ["title", "excerpt"],
    }).length > 0 ||
    value.translations.some((item) => !isStoredRichText(item.content)) ||
    !unique(value.tags ?? []) ||
    !unique(value.relatedDishIds ?? []) ||
    !unique(value.relatedBlogIds ?? [])
  ) {
    throw new BlogServiceError("invalid_input");
  }
}

function references(
  value: Pick<BlogWrite, "bannerMediaId" | "imageMediaId" | "relatedBlogIds" | "relatedDishIds">,
): BlogReferenceSet {
  return {
    bannerMediaId: value.bannerMediaId,
    imageMediaId: value.imageMediaId,
    relatedBlogIds: value.relatedBlogIds,
    relatedDishIds: value.relatedDishIds,
  };
}

async function validateReferences(
  deps: BlogServiceDependencies,
  value: BlogWrite,
  blogId?: string,
): Promise<void> {
  if (blogId && value.relatedBlogIds.some((id) => id.toLowerCase() === blogId.toLowerCase())) {
    throw new BlogServiceError("self_relationship", [{ kind: "blog", id: blogId }]);
  }
  const inspection = await deps.inspectReferences(references(value));
  if (inspection.missing.length)
    throw new BlogServiceError("missing_reference", inspection.missing);
  if (inspection.archived.length)
    throw new BlogServiceError("archived_reference", inspection.archived);
  if (
    blogId &&
    value.relatedBlogIds.length > 0 &&
    (await deps.repository.wouldCreateRelationshipCycle(blogId, value.relatedBlogIds))
  ) {
    throw new BlogServiceError("circular_relationship");
  }
}

function createWrite(input: BlogInput, actor: BlogActor, slug: string): BlogWrite {
  return {
    translations: input.translations,
    slug,
    imageMediaId: input.imageMediaId ?? null,
    bannerMediaId: input.bannerMediaId ?? null,
    readTimeMinutes: input.readTimeMinutes ?? 1,
    authorAdminId: actor.id,
    authorSnapshot: { displayName: actor.displayName },
    status: "draft",
    publishAt: null,
    publishedAt: null,
    tags: input.tags ?? [],
    relatedDishIds: input.relatedDishIds ?? [],
    relatedBlogIds: input.relatedBlogIds ?? [],
  };
}

function updateWrite(current: BlogSnapshot, update: BlogUpdate, slug: string): BlogWrite {
  const value = blogWriteFromSnapshot(current);
  return {
    ...value,
    translations: update.translations ?? value.translations,
    slug,
    imageMediaId: update.imageMediaId === undefined ? value.imageMediaId : update.imageMediaId,
    bannerMediaId: update.bannerMediaId === undefined ? value.bannerMediaId : update.bannerMediaId,
    readTimeMinutes: update.readTimeMinutes ?? value.readTimeMinutes,
    tags: update.tags ?? value.tags,
    relatedDishIds: update.relatedDishIds ?? value.relatedDishIds,
    relatedBlogIds: update.relatedBlogIds ?? value.relatedBlogIds,
  };
}

function requirePermission(actor: BlogActor, action: BlogAction): void {
  const permission =
    action === "create"
      ? "blogs:create"
      : action === "read" || action === "preview"
        ? "blogs:read"
        : action === "publish" || action === "unpublish" || action === "schedule"
          ? "blogs:publish"
          : action === "archive"
            ? "blogs:delete"
            : "blogs:update";
  if (!hasAdminPermission({ role: actor.role, active: true }, permission)) {
    throw new BlogServiceError("forbidden");
  }
}

async function execute<T>(
  deps: BlogServiceDependencies,
  actor: BlogActor,
  action: BlogAction,
  work: () => Promise<Readonly<{ value: T; id: string | null; changedIds?: readonly string[] }>>,
): Promise<T> {
  let result: Readonly<{ value: T; id: string | null; changedIds?: readonly string[] }>;
  try {
    requirePermission(actor, action);
    result = await work();
  } catch (error) {
    await deps.audit({
      action,
      outcome:
        error instanceof BlogServiceError && error.code === "forbidden" ? "denied" : "failure",
      actorKind: "admin",
      actorId: actor.id,
      blogId: null,
    });
    throw error;
  }
  try {
    await deps.audit({
      action,
      outcome: "success",
      actorKind: "admin",
      actorId: actor.id,
      blogId: result.id,
    });
  } finally {
    if (result.changedIds) {
      for (const tag of tagsForContentChange({ area: "blogs", ids: result.changedIds }))
        deps.invalidate(tag);
    }
  }
  return result.value;
}

async function syncSeo(
  deps: BlogServiceDependencies,
  value: BlogSnapshot,
  actorId: string,
): Promise<BlogSnapshot> {
  const seoPageId = await deps.seo.sync(value);
  return seoPageId && seoPageId !== value.seoPageId
    ? deps.repository.setSeoPageId(value, seoPageId, actorId)
    : value;
}

function publicValue(value: BlogSnapshot, locale: SupportedLocale, detail: false): BlogPublicItem;
function publicValue(value: BlogSnapshot, locale: SupportedLocale, detail: true): BlogPublicDetail;
function publicValue(
  value: BlogSnapshot,
  locale: SupportedLocale,
  detail: boolean,
): BlogPublicDetail | BlogPublicItem {
  const title = resolveLocalizedValue(value.translations, "title", locale);
  const excerpt = resolveLocalizedValue(value.translations, "excerpt", locale);
  const content = resolveLocalizedValue(value.translations, "content", locale);
  if (!title || !excerpt || !content || !value.publishedAt) throw new BlogServiceError("not_found");
  const common: BlogPublicItem = {
    id: value.id,
    slug: value.slug,
    title: title.value,
    excerpt: excerpt.value,
    resolvedLocale: title.resolvedLocale,
    direction: title.direction,
    imageMediaId: value.imageMediaId,
    bannerMediaId: value.bannerMediaId,
    readTimeMinutes: value.readTimeMinutes,
    author: value.authorSnapshot.displayName,
    publishedAt: value.publishedAt,
    tags: value.tags,
    relatedDishIds: value.relatedDishIds,
    relatedBlogIds: value.relatedBlogIds,
    viewCount: value.viewCount,
  };
  return detail ? { ...common, content: content.value } : common;
}

export function createBlogServices(deps: BlogServiceDependencies) {
  const now = () => deps.now?.() ?? new Date();
  return {
    async create(actor: BlogActor, raw: BlogInput): Promise<BlogSnapshot> {
      return execute(deps, actor, "create", async () => {
        const parsed = inputSchema.safeParse(raw);
        if (!parsed.success) throw new BlogServiceError("invalid_input");
        const input = parsed.data as BlogInput;
        validateInput(input);
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const slug = (
            await resolveUniqueSlug({
              canonicalText: canonicalTitle(input.translations),
              ...(input.slugOverride !== undefined ? { adminOverride: input.slugOverride } : {}),
              isSlugTaken: (candidate) => deps.repository.isSlugTaken(candidate),
            })
          ).slug;
          const write = createWrite(input, actor, slug);
          await validateReferences(deps, write);
          try {
            const synced = await syncSeo(
              deps,
              await deps.repository.create(write, actor.id),
              actor.id,
            );
            return { value: synced, id: synced.id, changedIds: [synced.id, synced.slug] };
          } catch (error) {
            if (!(error instanceof BlogRepositoryConflictError)) throw error;
          }
        }
        throw new BlogServiceError("conflict");
      });
    },
    async get(actor: BlogActor, id: string): Promise<BlogSnapshot> {
      return execute(deps, actor, "read", async () => {
        const found = await deps.repository.findById(id);
        if (!found) throw new BlogServiceError("not_found");
        return { value: found, id: found.id };
      });
    },
    async list(
      actor: BlogActor,
      options: BlogListOptions,
    ): Promise<Awaited<ReturnType<BlogRepository["list"]>>> {
      return execute(deps, actor, "read", async () => {
        const parsed = listSchema.safeParse(options);
        if (!parsed.success || parsed.data.page * parsed.data.pageSize > 10_000)
          throw new BlogServiceError("invalid_input");
        const query: BlogListOptions = {
          page: parsed.data.page,
          pageSize: parsed.data.pageSize,
          ...(parsed.data.status ? { status: parsed.data.status } : {}),
          ...(parsed.data.authorAdminId ? { authorAdminId: parsed.data.authorAdminId } : {}),
          ...(parsed.data.search ? { search: parsed.data.search } : {}),
          ...(parsed.data.sortBy ? { sortBy: parsed.data.sortBy } : {}),
          ...(parsed.data.sortDirection ? { sortDirection: parsed.data.sortDirection } : {}),
        };
        return { value: await deps.repository.list(query), id: null };
      });
    },
    async update(actor: BlogActor, id: string, raw: BlogUpdate): Promise<BlogSnapshot> {
      return execute(deps, actor, "update", async () => {
        const parsed = updateSchema.safeParse(raw);
        if (!parsed.success) throw new BlogServiceError("invalid_input");
        const current = await deps.repository.findById(id);
        if (!current || current.status === "archived") throw new BlogServiceError("not_found");
        const update = parsed.data as BlogUpdate;
        if (update.translations) validateInput({ translations: update.translations });
        const slug = (
          await resolveUniqueSlug({
            canonicalText: canonicalTitle(update.translations ?? current.translations),
            ...(update.slugOverride !== undefined ? { adminOverride: update.slugOverride } : {}),
            currentSlug: current.slug,
            isSlugTaken: (candidate) => deps.repository.isSlugTaken(candidate, id),
          })
        ).slug;
        const write = updateWrite(current, update, slug);
        validateInput(write);
        await validateReferences(deps, write, id);
        const synced = await syncSeo(
          deps,
          await deps.repository.save(current, write, actor.id),
          actor.id,
        );
        return { value: synced, id, changedIds: [id, current.slug, synced.slug] };
      });
    },
    async issuePreview(
      actor: BlogActor,
      id: string,
    ): Promise<Readonly<{ token: string; expiresAt: string }>> {
      return execute(deps, actor, "preview", async () => {
        const found = await deps.repository.findById(id);
        if (!found || found.status === "archived") throw new BlogServiceError("not_found");
        const at = now();
        const token = issueBlogPreviewToken(
          { blogId: found.id, version: found.version },
          deps.previewSecret,
          { at },
        );
        return {
          value: { token, expiresAt: new Date(at.getTime() + 15 * 60_000).toISOString() },
          id,
        };
      });
    },
    async previewBySlug(
      slug: string,
      token: string | null,
      actor?: BlogActor,
    ): Promise<BlogSnapshot> {
      const found = await deps.repository.findBySlug(slug);
      if (!found || found.status === "archived") throw new BlogServiceError("not_found");
      if (actor) requirePermission(actor, "preview");
      else if (
        !verifyBlogPreviewToken(
          token,
          { blogId: found.id, version: found.version },
          deps.previewSecret,
          now(),
        )
      ) {
        throw new BlogServiceError("preview_denied");
      }
      return found;
    },
    async schedule(actor: BlogActor, id: string, publishAt: Date): Promise<BlogSnapshot> {
      return execute(deps, actor, "schedule", async () => {
        const current = await deps.repository.findById(id);
        if (!current || current.status === "archived") throw new BlogServiceError("not_found");
        if (current.translations.length !== SUPPORTED_LOCALES.length)
          throw new BlogServiceError("invalid_input");
        if (!Number.isFinite(publishAt.getTime()) || publishAt.getTime() <= now().getTime())
          throw new BlogServiceError("invalid_input");
        const write = {
          ...blogWriteFromSnapshot(current),
          status: "scheduled" as const,
          publishAt,
        };
        await validateReferences(deps, write, id);
        const synced = await syncSeo(
          deps,
          await deps.repository.save(current, write, actor.id),
          actor.id,
        );
        return { value: synced, id, changedIds: [id, current.slug] };
      });
    },
    async publish(actor: BlogActor, id: string): Promise<BlogSnapshot> {
      return execute(deps, actor, "publish", async () => {
        const current = await deps.repository.findById(id);
        if (!current || current.status === "archived") throw new BlogServiceError("not_found");
        if (current.translations.length !== SUPPORTED_LOCALES.length)
          throw new BlogServiceError("invalid_input");
        const write = {
          ...blogWriteFromSnapshot(current),
          status: "published" as const,
          publishAt: null,
          publishedAt: current.publishedAt ? new Date(current.publishedAt) : now(),
        };
        await validateReferences(deps, write, id);
        const synced = await syncSeo(
          deps,
          await deps.repository.save(current, write, actor.id),
          actor.id,
        );
        return { value: synced, id, changedIds: [id, current.slug] };
      });
    },
    async unpublish(actor: BlogActor, id: string): Promise<BlogSnapshot> {
      return execute(deps, actor, "unpublish", async () => {
        const current = await deps.repository.findById(id);
        if (!current) throw new BlogServiceError("not_found");
        if (current.status !== "published" && current.status !== "scheduled")
          throw new BlogServiceError("invalid_transition");
        const write = {
          ...blogWriteFromSnapshot(current),
          status: "draft" as const,
          publishAt: null,
        };
        const synced = await syncSeo(
          deps,
          await deps.repository.save(current, write, actor.id),
          actor.id,
        );
        return { value: synced, id, changedIds: [id, current.slug] };
      });
    },
    async archive(actor: BlogActor, id: string): Promise<BlogSnapshot> {
      return execute(deps, actor, "archive", async () => {
        const current = await deps.repository.findById(id);
        if (!current) throw new BlogServiceError("not_found");
        const write = {
          ...blogWriteFromSnapshot(current),
          status: "archived" as const,
          publishAt: null,
        };
        const saved = await deps.repository.save(current, write, actor.id);
        const [affectedBlogs, affectedDishes] = await Promise.all([
          deps.repository.removeInboundRelationships(id, actor.id),
          deps.removeInboundDishRelationships(id, actor.id),
        ]);
        if (affectedDishes.length > 0) {
          for (const tag of tagsForContentChange({ area: "dishes", ids: affectedDishes })) {
            deps.invalidate(tag);
          }
        }
        const synced = await syncSeo(deps, saved, actor.id);
        return {
          value: synced,
          id,
          changedIds: [id, current.slug, ...affectedBlogs],
        };
      });
    },
    async listPublic(
      options: Omit<BlogListOptions, "status" | "authorAdminId"> & { locale?: SupportedLocale },
    ) {
      const locale = options.locale ?? DEFAULT_LOCALE;
      const result = await deps.repository.listPublic(options);
      return {
        items: result.items.map((item) => publicValue(item, locale, false)),
        total: result.total,
      };
    },
    async getPublicBySlug(
      slug: string,
      locale: SupportedLocale = DEFAULT_LOCALE,
    ): Promise<BlogPublicDetail> {
      const found = await deps.repository.findBySlug(slug, true);
      if (!found) throw new BlogServiceError("not_found");
      return publicValue(found, locale, true);
    },
    async publishScheduled(): Promise<readonly BlogSnapshot[]> {
      const at = now();
      const published = await deps.repository.publishDue(at);
      for (const blog of published) {
        await deps.seo.sync(blog);
        await deps.audit({
          action: "publish",
          outcome: "success",
          actorKind: "system",
          actorId: null,
          blogId: blog.id,
        });
        for (const tag of tagsForContentChange({ area: "blogs", ids: [blog.id, blog.slug] }))
          deps.invalidate(tag);
      }
      return published;
    },
  };
}
