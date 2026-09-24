import "server-only";

import { after, type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import type { Connection } from "mongoose";

import type { AdminPermission } from "@/constants/admin-access";
import { LOCALE_COOKIE_NAME, resolveLocalePreference } from "@/locales/routing";
import { CONTENT_REVALIDATE_SECONDS } from "@/server/cache";
import { connectToDatabase } from "@/server/database";
import { getServerEnvironment } from "@/server/environment";
import { ApiError, consumeRequestRateLimit, getRequestValidationOptions } from "@/server/http";
import {
  AuthorizationGuardError,
  adminCookieName,
  isProtectedMutation,
  requireAdminActor,
  resolveAdminActor,
} from "@/server/modules/auth";
import {
  BlogRepositoryConflictError,
  BlogServiceError,
  createBlogAuditSink,
  createBlogRepository,
  createBlogServices,
  createBlogViewCounter,
  createBlogViewRepository,
  type BlogReferenceIssue,
  type BlogReferenceSet,
} from "@/server/modules/blogs";
import { createDishRepository, removeBlogRelationshipsFromDishes } from "@/server/modules/dishes";
import { getMediaReferenceFacts } from "@/server/modules/media";
import { createApplicationLogger } from "@/server/observability";
import { SlugPolicyError } from "@/server/slugs";

export const BLOG_PUBLIC_CACHE_CONTROL = `public, s-maxage=${CONTENT_REVALIDATE_SECONDS}, stale-while-revalidate=300`;

export async function blogPublicRequestContext(
  request: NextRequest,
  scope: "list" | "detail" | "preview" | "view",
) {
  const connection = await connectToDatabase();
  await consumeRequestRateLimit(connection, request, {
    scope: `blog-${scope}`,
    limit: scope === "list" ? 240 : scope === "view" ? 120 : 180,
    windowMs: 60_000,
  });
  const locale = resolveLocalePreference(request.cookies.get(LOCALE_COOKIE_NAME)?.value);
  return { connection, locale, validation: await getRequestValidationOptions(locale) };
}

export async function blogAdminRequestContext(
  request: NextRequest,
  permission: AdminPermission,
  mutation = false,
) {
  const token = request.cookies.get(adminCookieName())?.value;
  if (!token) throw ApiError.authentication();
  if (mutation && !isProtectedMutation(request, "admin", token)) throw ApiError.authorization();
  const connection = await connectToDatabase();
  try {
    const actor = await requireAdminActor(connection, token, permission);
    const locale = resolveLocalePreference(request.cookies.get(LOCALE_COOKIE_NAME)?.value);
    return { connection, actor, validation: await getRequestValidationOptions(locale) };
  } catch (error) {
    if (error instanceof AuthorizationGuardError) {
      throw error.reason === "unauthenticated"
        ? ApiError.authentication()
        : ApiError.authorization();
    }
    throw error;
  }
}

async function inspectBlogReferences(
  connection: Connection,
  blogRepository: ReturnType<typeof createBlogRepository>,
  refs: BlogReferenceSet,
) {
  const mediaIds = [refs.imageMediaId, refs.bannerMediaId].filter((id): id is string =>
    Boolean(id),
  );
  const [media, dishes, blogs] = await Promise.all([
    getMediaReferenceFacts(connection, mediaIds),
    Promise.all(refs.relatedDishIds.map((id) => createDishRepository(connection).findById(id))),
    Promise.all(refs.relatedBlogIds.map((id) => blogRepository.findById(id))),
  ]);
  const mediaById = new Map(media.map((item) => [item.id, item]));
  const missing: BlogReferenceIssue[] = [];
  const archived: BlogReferenceIssue[] = [];
  for (const [kind, id] of [
    ["image_media", refs.imageMediaId],
    ["banner_media", refs.bannerMediaId],
  ] as const) {
    if (!id) continue;
    const value = mediaById.get(id);
    if (!value) missing.push({ kind, id });
    else if (value.kind !== "image" || value.processingState !== "ready")
      archived.push({ kind, id });
  }
  dishes.forEach((value, index) => {
    const id = refs.relatedDishIds[index];
    if (!id) return;
    if (!value) missing.push({ kind: "dish", id });
    else if (value.status === "archived") archived.push({ kind: "dish", id });
  });
  blogs.forEach((value, index) => {
    const id = refs.relatedBlogIds[index];
    if (!id) return;
    if (!value) missing.push({ kind: "blog", id });
    else if (value.status === "archived") archived.push({ kind: "blog", id });
  });
  return { missing, archived };
}

export function resolveBlogServices(connection: Connection, requestId: string) {
  const repository = createBlogRepository(connection);
  return createBlogServices({
    repository,
    inspectReferences: (references) => inspectBlogReferences(connection, repository, references),
    // The SEO port is already enforced by the service; SK-0107/0108 supplies persistence.
    seo: { sync: async () => null },
    removeInboundDishRelationships: (blogId, actorId) =>
      removeBlogRelationshipsFromDishes(connection, blogId, actorId),
    audit: createBlogAuditSink(connection, { requestId }),
    invalidate: (tag) => revalidateTag(tag, { expire: 0 }),
    previewSecret: getServerEnvironment().AUTH_SESSION_SECRET,
  });
}

export async function optionalBlogPreviewActor(connection: Connection, request: NextRequest) {
  return resolveAdminActor(connection, request.cookies.get(adminCookieName())?.value);
}

export function queueBlogView(
  connection: Connection,
  requestId: string,
  signal: Parameters<ReturnType<typeof createBlogViewCounter>["queue"]>[0],
) {
  return createBlogViewCounter({
    repository: createBlogViewRepository(connection),
    secret: getServerEnvironment().AUTH_SESSION_SECRET,
    schedule: (work) => after(work),
    logger: createApplicationLogger({ module: "blogs", requestId }),
  }).queue(signal);
}

export function translateBlogError(error: unknown): never {
  if (error instanceof BlogServiceError) {
    if (error.code === "forbidden" || error.code === "preview_denied")
      throw ApiError.authorization();
    if (error.code === "not_found") throw ApiError.notFound("blog");
    if (error.code === "conflict" || error.code === "invalid_transition")
      throw ApiError.conflict({ resource: "blog" });
    throw ApiError.validation([
      { code: error.code, message: "The blog data is not accepted.", path: [] },
    ]);
  }
  if (error instanceof BlogRepositoryConflictError) throw ApiError.conflict({ resource: "blog" });
  if (error instanceof SlugPolicyError) {
    throw ApiError.validation([
      { code: error.code, message: "Choose a valid blog slug.", path: ["slugOverride"] },
    ]);
  }
  throw error;
}
