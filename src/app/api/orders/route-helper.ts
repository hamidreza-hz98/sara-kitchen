import "server-only";

import type { NextRequest } from "next/server";

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
import { OrderManagementError, OrderTransitionError } from "@/server/modules/orders";

export async function orderRequestContext(
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
    if (error instanceof AuthorizationGuardError)
      throw error.reason === "unauthenticated"
        ? ApiError.authentication()
        : ApiError.authorization();
    throw error;
  }
}

export function translateOrderError(error: unknown): never {
  if (error instanceof Error && error.name === "VersionError") {
    throw ApiError.conflict({
      resource: "order",
      publicMessage: "This order changed. Reload and try again.",
    });
  }
  if (error instanceof OrderManagementError) {
    if (error.code === "forbidden") throw ApiError.authorization();
    if (error.code === "not_found") throw ApiError.notFound("order");
    if (error.code === "conflict") throw ApiError.conflict({ resource: "order" });
    throw ApiError.validation([
      { code: "invalid_order_action", path: [], message: "Order action is invalid." },
    ]);
  }
  if (error instanceof OrderTransitionError) {
    if (error.code === "permission_denied" || error.code === "ownership_mismatch")
      throw ApiError.authorization();
    throw ApiError.conflict({ resource: "order", publicMessage: error.message });
  }
  throw error;
}
