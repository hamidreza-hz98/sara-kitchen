import type { NextRequest } from "next/server";
import { z } from "zod";

import { LOCALE_COOKIE_NAME, resolveLocalePreference } from "@/locales/routing";
import { connectToDatabase } from "@/server/database";
import {
  ApiError,
  apiSuccess,
  getRequestValidationOptions,
  parseJsonRequest,
  parseQueryParameters,
} from "@/server/http";
import {
  ActorSessionRejectedError,
  AuthorizationGuardError,
  adminCookieName,
  customerCookieName,
  getActorActiveSessions,
  isProtectedMutation,
  limitSensitiveAccountOperation,
  requireAdminActor,
  requireCustomerActor,
  revokeActorSessionById,
  revokeAllOtherActorSessions,
  type SessionPrincipal,
} from "@/server/modules/auth";

const listQuery = z.strictObject({
  page: z.coerce.number().int().min(1).max(1_000).default(1),
});
const revokeInput = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("one"), sessionId: z.string().regex(/^[a-f\d]{24}$/iu) }),
  z.strictObject({ action: z.literal("others") }),
]);

function bearer(request: NextRequest, principal: SessionPrincipal): string | undefined {
  return request.cookies.get(principal === "admin" ? adminCookieName() : customerCookieName())
    ?.value;
}

function rethrowSessionError(error: unknown): never {
  if (error instanceof ActorSessionRejectedError) {
    if (error.reason === "not-found") throw ApiError.notFound("session");
    throw ApiError.authentication();
  }
  throw error;
}

export async function readActorSessions(request: NextRequest, principal: SessionPrincipal) {
  const locale = resolveLocalePreference(request.cookies.get(LOCALE_COOKIE_NAME)?.value);
  const { page } = parseQueryParameters(
    request,
    listQuery,
    await getRequestValidationOptions(locale),
  );
  try {
    const result = await getActorActiveSessions(
      await connectToDatabase(),
      principal,
      bearer(request, principal),
      page,
    );
    return apiSuccess(result);
  } catch (error) {
    return rethrowSessionError(error);
  }
}

export async function mutateActorSessions(request: NextRequest, principal: SessionPrincipal) {
  const token = bearer(request, principal);
  if (!isProtectedMutation(request, principal, token)) throw ApiError.authorization();
  const locale = resolveLocalePreference(request.cookies.get(LOCALE_COOKIE_NAME)?.value);
  const input = await parseJsonRequest(
    request,
    revokeInput,
    await getRequestValidationOptions(locale),
  );
  try {
    const connection = await connectToDatabase();
    const actor =
      principal === "admin"
        ? await requireAdminActor(connection, token)
        : await requireCustomerActor(connection, token);
    await limitSensitiveAccountOperation(connection, request, {
      principal,
      actorId: actor.id,
      operation: "sessions",
    });
    if (input.action === "one") {
      await revokeActorSessionById(connection, principal, token, input.sessionId);
      return apiSuccess({ revoked: 1 });
    }
    const revoked = await revokeAllOtherActorSessions(connection, principal, token);
    return apiSuccess({ revoked });
  } catch (error) {
    if (error instanceof AuthorizationGuardError) throw ApiError.authentication();
    return rethrowSessionError(error);
  }
}
