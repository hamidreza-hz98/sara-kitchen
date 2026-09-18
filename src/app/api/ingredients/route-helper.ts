import "server-only";

import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import type { Connection } from "mongoose";

import type { AdminPermission } from "@/constants/admin-access";
import { LOCALE_COOKIE_NAME, resolveLocalePreference } from "@/locales/routing";
import { connectToDatabase } from "@/server/database";
import { ApiError, getRequestValidationOptions } from "@/server/http";
import {
  AuthorizationGuardError,
  adminCookieName,
  isProtectedMutation,
  requireAdminActor,
} from "@/server/modules/auth";
import { countDishesUsingIngredient } from "@/server/modules/dishes";
import {
  IngredientMediaReferenceError,
  IngredientRepositoryConflictError,
  IngredientServiceError,
  createIngredientAuditSink,
  createIngredientRepository,
  createIngredientServices,
  validateIngredientImageReference,
} from "@/server/modules/ingredients";

export async function ingredientRequestContext(
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

export function resolveIngredientServices(connection: Connection, requestId: string) {
  return createIngredientServices({
    repository: createIngredientRepository(connection),
    validateImage: (id) => validateIngredientImageReference(connection, id),
    countDishReferences: (id) => countDishesUsingIngredient(connection, id),
    audit: createIngredientAuditSink(connection, { requestId }),
    invalidate: (tag) => revalidateTag(tag, { expire: 0 }),
  });
}

export function translateIngredientServiceError(error: unknown): never {
  if (error instanceof IngredientServiceError) {
    if (error.code === "forbidden") throw ApiError.authorization();
    if (error.code === "not_found") throw ApiError.notFound("ingredient");
    if (error.code === "conflict" || error.code === "referenced" || error.code === "not_archived") {
      throw ApiError.conflict({ resource: "ingredient" });
    }
    throw ApiError.validation([
      { code: error.code, message: "The ingredient data is not accepted.", path: [] },
    ]);
  }
  if (error instanceof IngredientRepositoryConflictError) {
    throw ApiError.conflict({ resource: "ingredient" });
  }
  if (error instanceof IngredientMediaReferenceError) {
    throw ApiError.validation([
      {
        code: "invalid_media_reference",
        message: "Choose an existing, ready image.",
        path: ["imageMediaId"],
      },
    ]);
  }
  throw error;
}
