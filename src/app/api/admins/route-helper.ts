import "server-only";

import type { NextRequest } from "next/server";
import type { Connection } from "mongoose";

import type { AdminPermission } from "@/constants/admin-access";
import { LOCALE_COOKIE_NAME, resolveLocalePreference } from "@/locales/routing";
import { connectToDatabase } from "@/server/database";
import { ApiError, getRequestValidationOptions } from "@/server/http";
import {
  AdminCrudError,
  AdminRepositoryConflictError,
  createAdminAuditSink,
  createAdminCrudServices,
  createAdminRepository,
} from "@/server/modules/admins";
import {
  AuthorizationGuardError,
  adminCookieName,
  isProtectedMutation,
  requireAdminActor,
} from "@/server/modules/auth";
import { revokeActorSessions } from "@/server/modules/sessions";

export async function adminRequestContext(
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

export function resolveAdminCrudServices(
  connection: Connection,
  requestId: string,
  userAgent?: string | null,
) {
  return createAdminCrudServices({
    repository: createAdminRepository(connection),
    audit: createAdminAuditSink(connection, {
      requestId,
      ...(userAgent !== undefined ? { userAgent } : {}),
    }),
    revokeSessions: (adminId, reason) => revokeActorSessions(connection, "admin", adminId, reason),
  });
}

export function translateAdminCrudError(error: unknown): never {
  if (error instanceof AdminCrudError) {
    if (error.code === "forbidden") throw ApiError.authorization();
    if (error.code === "not_found") throw ApiError.notFound("admin");
    if (error.code === "conflict") throw ApiError.conflict({ resource: "admin" });
    if (error.code === "last_owner") {
      throw ApiError.conflict({
        resource: "admin",
        publicMessage: "The final active owner cannot lose owner access.",
      });
    }
    if (error.code === "self_protected") {
      throw ApiError.conflict({
        resource: "admin",
        publicMessage: "You cannot remove your own critical administrator access.",
      });
    }
    throw ApiError.validation([
      { code: error.code, message: "The administrator data is not accepted.", path: [] },
    ]);
  }
  if (error instanceof AdminRepositoryConflictError)
    throw ApiError.conflict({ field: "identifier", resource: "admin" });
  throw error;
}
