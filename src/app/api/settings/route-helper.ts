import "server-only";

import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import type { Connection } from "mongoose";

import type { AdminPermission } from "@/constants/admin-access";
import { LOCALE_COOKIE_NAME, resolveLocalePreference } from "@/locales/routing";
import { tagsForContentChange } from "@/server/cache";
import { connectToDatabase } from "@/server/database";
import { ApiError, getRequestValidationOptions } from "@/server/http";
import {
  AuthorizationGuardError,
  adminCookieName,
  isProtectedMutation,
  requireAdminActor,
} from "@/server/modules/auth";
import { SettingsServiceError, createSettingsRuntime } from "@/server/modules/settings";

export async function settingsRequestContext(
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

export function resolveSettingsRuntime(
  connection: Connection,
  requestId: string,
  request: NextRequest,
) {
  return createSettingsRuntime(connection, {
    requestId,
    userAgent: request.headers.get("user-agent"),
  });
}

export function translateSettingsError(error: unknown): never {
  if (error instanceof SettingsServiceError) {
    if (error.code === "forbidden") throw ApiError.authorization();
    if (error.code === "not_found") throw ApiError.notFound("settings_section");
    if (error.code === "conflict") throw ApiError.conflict({ resource: "settings_section" });
    throw ApiError.validation([
      { code: error.code, message: "The settings data is not accepted.", path: [] },
    ]);
  }
  throw error;
}

export function invalidateTermsSettings(): void {
  for (const tag of tagsForContentChange({ area: "settings", ids: ["terms"] })) {
    revalidateTag(tag, { expire: 0 });
  }
}
