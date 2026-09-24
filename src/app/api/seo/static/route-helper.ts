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
import { getMediaReferenceFacts } from "@/server/modules/media";
import {
  StaticSeoRepositoryConflictError,
  StaticSeoServiceError,
  createStaticSeoAuditSink,
  createStaticSeoRepository,
  createStaticSeoServices,
} from "@/server/modules/seo";

export async function staticSeoRequestContext(
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

export function resolveStaticSeoServices(connection: Connection, requestId: string) {
  return createStaticSeoServices({
    repository: createStaticSeoRepository(connection),
    async validateShareImage(mediaId) {
      if (!mediaId) return;
      const [fact] = await getMediaReferenceFacts(connection, [mediaId]);
      if (!fact || fact.kind !== "image" || fact.processingState !== "ready") {
        throw new StaticSeoServiceError("invalid_input");
      }
    },
    audit: createStaticSeoAuditSink(connection, { requestId }),
    invalidate: (tag) => revalidateTag(tag, { expire: 0 }),
  });
}

export function translateStaticSeoError(error: unknown): never {
  if (error instanceof StaticSeoServiceError) {
    if (error.code === "forbidden") throw ApiError.authorization();
    if (error.code === "not_found") throw ApiError.notFound("seo_page");
    if (error.code === "conflict") throw ApiError.conflict({ resource: "seo_page" });
    throw ApiError.validation([
      { code: error.code, message: "The static SEO data is not accepted.", path: [] },
    ]);
  }
  if (error instanceof StaticSeoRepositoryConflictError) {
    throw ApiError.conflict({ resource: "seo_page" });
  }
  throw error;
}
