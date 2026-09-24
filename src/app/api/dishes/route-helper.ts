import "server-only";

import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import type { Connection } from "mongoose";

import type { SupportedLocale } from "@/constants";
import type { AdminPermission } from "@/constants/admin-access";
import { LOCALE_COOKIE_NAME, resolveLocalePreference } from "@/locales/routing";
import { CONTENT_REVALIDATE_SECONDS } from "@/server/cache";
import { connectToDatabase } from "@/server/database";
import { ApiError, consumeRequestRateLimit, getRequestValidationOptions } from "@/server/http";
import {
  AuthorizationGuardError,
  adminCookieName,
  isProtectedMutation,
  requireAdminActor,
} from "@/server/modules/auth";
import { createBlogRepository } from "@/server/modules/blogs";
import { createCategoryRepository } from "@/server/modules/categories";
import {
  DishCatalogQueryError,
  DishRepositoryConflictError,
  DishServiceError,
  createDishAuditSink,
  createDishCatalogRepository,
  createDishCatalogService,
  createDishRepository,
  createDishServices,
  type DishReferenceIssue,
  type DishReferenceSet,
} from "@/server/modules/dishes";
import {
  createIngredientAllergenCatalog,
  createIngredientRepository,
} from "@/server/modules/ingredients";
import { getMediaReferenceFacts } from "@/server/modules/media";
import { createAutomaticSeoSynchronizer } from "@/server/modules/seo";
import { getApplicationSiteUrl } from "@/server/environment";
import { SlugPolicyError } from "@/server/slugs";

export const DISH_PUBLIC_CACHE_CONTROL = `public, s-maxage=${CONTENT_REVALIDATE_SECONDS}, stale-while-revalidate=300`;

export async function enforceDishReadRateLimit(
  connection: Connection,
  request: Request,
  scope: "catalog" | "detail",
): Promise<void> {
  await consumeRequestRateLimit(connection, request, {
    scope: `dish-${scope}`,
    limit: scope === "catalog" ? 240 : 180,
    windowMs: 60_000,
  });
}

export async function dishPublicRequestContext(request: NextRequest, scope: "catalog" | "detail") {
  const connection = await connectToDatabase();
  await enforceDishReadRateLimit(connection, request, scope);
  const locale = resolveLocalePreference(request.cookies.get(LOCALE_COOKIE_NAME)?.value);
  return {
    connection,
    locale,
    validation: await getRequestValidationOptions(locale),
  };
}

export async function dishAdminRequestContext(
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

export function resolveDishCatalog(connection: Connection) {
  return createDishCatalogService({
    repository: createDishCatalogRepository(connection),
    ingredients: createIngredientAllergenCatalog(connection),
  });
}

async function inspectDishReferences(
  connection: Connection,
  repository: ReturnType<typeof createDishRepository>,
  references: DishReferenceSet,
) {
  const mediaFacts = await getMediaReferenceFacts(connection, references.mediaIds);
  const mediaById = new Map(mediaFacts.map((fact) => [fact.id, fact]));
  const categories = createCategoryRepository(connection);
  const ingredients = createIngredientRepository(connection);
  const blogs = createBlogRepository(connection);
  const [categoryValues, ingredientValues, dishValues, blogValues] = await Promise.all([
    Promise.all(references.categoryIds.map((id) => categories.findById(id))),
    Promise.all(references.ingredientIds.map((id) => ingredients.findById(id))),
    Promise.all(references.relatedDishIds.map((id) => repository.findById(id))),
    Promise.all(references.relatedBlogIds.map((id) => blogs.findById(id))),
  ]);
  const missing: DishReferenceIssue[] = [];
  const archived: DishReferenceIssue[] = [];
  for (const id of references.mediaIds) {
    const fact = mediaById.get(id);
    if (!fact) missing.push({ kind: "media", id });
    else if (fact.processingState !== "ready" || !["image", "video"].includes(fact.kind)) {
      archived.push({ kind: "media", id });
    }
  }
  const inspect = (
    kind: "category" | "ingredient" | "dish" | "blog",
    ids: readonly string[],
    values: readonly ({ status: string } | null)[],
  ) => {
    values.forEach((value, index) => {
      const id = ids[index];
      if (!id) return;
      if (!value) missing.push({ kind, id });
      else if (value.status === "archived") archived.push({ kind, id });
    });
  };
  inspect("category", references.categoryIds, categoryValues);
  inspect("ingredient", references.ingredientIds, ingredientValues);
  inspect("dish", references.relatedDishIds, dishValues);
  inspect("blog", references.relatedBlogIds, blogValues);
  return { missing, archived };
}

export function resolveDishServices(connection: Connection, requestId: string) {
  const repository = createDishRepository(connection);
  const seo = createAutomaticSeoSynchronizer(connection, { siteUrl: getApplicationSiteUrl() });
  return createDishServices({
    repository,
    inspectReferences: (references) => inspectDishReferences(connection, repository, references),
    seo: {
      sync: seo.dish,
      remove: (dish) => seo.remove("dish", dish.id),
    },
    audit: createDishAuditSink(connection, { requestId }),
    invalidate: (tag) => revalidateTag(tag, { expire: 0 }),
  });
}

export function translateDishError(error: unknown): never {
  if (error instanceof DishCatalogQueryError) {
    if (error.code === "not_found") throw ApiError.notFound("dish");
    throw ApiError.validation([
      { code: error.code, message: "The dish query is not accepted.", path: [] },
    ]);
  }
  if (error instanceof DishServiceError) {
    if (error.code === "forbidden") throw ApiError.authorization();
    if (error.code === "not_found") throw ApiError.notFound("dish");
    if (error.code === "conflict" || error.code === "not_archived") {
      throw ApiError.conflict({ resource: "dish" });
    }
    throw ApiError.validation([
      { code: error.code, message: "The dish data is not accepted.", path: [] },
    ]);
  }
  if (error instanceof DishRepositoryConflictError) throw ApiError.conflict({ resource: "dish" });
  if (error instanceof SlugPolicyError) {
    throw ApiError.validation([
      { code: error.code, message: "Choose a valid dish slug.", path: ["slugOverride"] },
    ]);
  }
  throw error;
}

export function publicDishQueryLocale(
  queryLocale: SupportedLocale | undefined,
  cookieLocale: SupportedLocale,
): SupportedLocale {
  return queryLocale ?? cookieLocale;
}
