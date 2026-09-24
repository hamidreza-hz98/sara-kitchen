import "server-only";

import type { NextRequest } from "next/server";
import type { Connection } from "mongoose";
import { revalidateTag } from "next/cache";

import type { AdminPermission } from "@/constants/admin-access";
import { LOCALE_COOKIE_NAME, resolveLocalePreference } from "@/locales/routing";
import { connectToDatabase } from "@/server/database";
import { getApplicationSiteUrl } from "@/server/environment";
import { ApiError, getRequestValidationOptions } from "@/server/http";
import {
  AuthorizationGuardError,
  adminCookieName,
  isProtectedMutation,
  requireAdminActor,
} from "@/server/modules/auth";
import {
  CategoryMediaReferenceError,
  CategoryRepositoryConflictError,
  CategoryServiceError,
  createCategoryAuditSink,
  createCategoryRepository,
  createCategoryServices,
  validateCategoryMediaReferences,
} from "@/server/modules/categories";
import { countDishesUsingCategory } from "@/server/modules/dishes";
import { createAutomaticSeoSynchronizer } from "@/server/modules/seo";
import { SlugPolicyError } from "@/server/slugs";

export type CategoryMutationServices = Pick<
  ReturnType<typeof createCategoryServices>,
  "create" | "update" | "archive"
>;

export async function categoryRequestContext(
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

/** Mutations remain closed until SEO, Dish, and media-reference integration is durable. */
export function categoryMutationUnavailable(): never {
  throw ApiError.serviceUnavailable("Category changes are temporarily unavailable.");
}

export function resolveCategoryMutationServices(
  connection: Connection,
  requestId: string,
): CategoryMutationServices {
  const seo = createAutomaticSeoSynchronizer(connection, { siteUrl: getApplicationSiteUrl() });
  return createCategoryServices({
    repository: createCategoryRepository(connection),
    validateMedia: (references) => validateCategoryMediaReferences(connection, references),
    countDishReferences: (categoryId) => countDishesUsingCategory(connection, categoryId),
    seo: {
      sync: seo.category,
      remove: (category) => seo.remove("category", category.id),
    },
    audit: createCategoryAuditSink(connection, { requestId }),
    invalidate: (tag) => revalidateTag(tag, { expire: 0 }),
  });
}

export function translateCategoryServiceError(error: unknown): never {
  if (error instanceof CategoryServiceError) {
    if (error.code === "forbidden") throw ApiError.authorization();
    if (error.code === "not_found") throw ApiError.notFound("category");
    if (error.code === "conflict" || error.code === "referenced" || error.code === "not_archived") {
      throw ApiError.conflict({ resource: "category" });
    }
    throw ApiError.validation([
      { code: error.code, message: "The category data is not accepted.", path: [] },
    ]);
  }
  if (error instanceof CategoryRepositoryConflictError)
    throw ApiError.conflict({ resource: "category" });
  if (error instanceof CategoryMediaReferenceError) {
    throw ApiError.validation([
      { code: "invalid_media_reference", message: "Choose a ready image.", path: [error.field] },
    ]);
  }
  if (error instanceof SlugPolicyError) {
    throw ApiError.validation([
      { code: error.code, message: "Choose a valid category slug.", path: ["slugOverride"] },
    ]);
  }
  throw error;
}
