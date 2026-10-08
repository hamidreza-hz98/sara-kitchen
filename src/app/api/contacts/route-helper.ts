import "server-only";

import { createHmac } from "node:crypto";

import type { NextRequest } from "next/server";
import type { Connection } from "mongoose";

import type { AdminPermission } from "@/constants/admin-access";
import { LOCALE_COOKIE_NAME, resolveLocalePreference } from "@/locales/routing";
import { connectToDatabase } from "@/server/database";
import { getServerEnvironment } from "@/server/environment";
import { ApiError, getRequestValidationOptions } from "@/server/http";
import { getActiveAdminIdentity } from "@/server/modules/admins";
import {
  AuthorizationGuardError,
  adminCookieName,
  isProtectedMutation,
  requireAdminActor,
} from "@/server/modules/auth";
import {
  ContactFlowError,
  ContactRepositoryConflictError,
  createContactAuditSink,
  createContactFlow,
  createContactSubmissionRepository,
  type ContactSubmissionInput,
} from "@/server/modules/contacts";
import { createApplicationLogger } from "@/server/observability";

export async function contactAdminRequestContext(
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

export async function contactPublicRequestContext(request: NextRequest) {
  const connection = await connectToDatabase();
  const locale = resolveLocalePreference(request.cookies.get(LOCALE_COOKIE_NAME)?.value);
  return { connection, validation: await getRequestValidationOptions(locale) };
}

function contactFingerprint(input: Pick<ContactSubmissionInput, "email" | "message" | "mobile">) {
  return createHmac("sha256", getServerEnvironment().AUTH_SESSION_SECRET)
    .update(
      JSON.stringify({
        email: input.email ?? "",
        message: input.message.trim().toLocaleLowerCase("en"),
        mobile: input.mobile ?? "",
      }),
    )
    .digest("hex");
}

export function resolveContactFlow(
  connection: Connection,
  requestId: string,
  userAgent: string | null,
) {
  const logger = createApplicationLogger({ module: "contacts", requestId });
  return createContactFlow({
    repository: createContactSubmissionRepository(connection),
    fingerprint: contactFingerprint,
    assigneeExists: async (adminId) => Boolean(await getActiveAdminIdentity(connection, adminId)),
    audit: createContactAuditSink(connection, { requestId, userAgent }),
    now: () => new Date(),
    // The adapter intentionally emits no submitter PII or message body. A future WhatsApp/email
    // transport can consume this same minimal event without changing persistence semantics.
    notify: async (notification) => {
      logger.info({
        action: "notification.queued",
        message: "A contact-submission administration notification was queued.",
        context: notification,
      });
    },
    notificationFailed: (error, contactId) => {
      logger.error({
        action: "notification.failed",
        message: "A contact-submission notification failed after durable persistence.",
        context: { contactId },
        error,
      });
    },
  });
}

export function contactReferrerHost(request: Request): string | null {
  const value = request.headers.get("referer");
  if (!value) return null;
  try {
    return new URL(value).hostname.slice(0, 253) || null;
  } catch {
    return null;
  }
}

export function translateContactFlowError(error: unknown): never {
  if (error instanceof ContactFlowError) {
    if (error.code === "forbidden") throw ApiError.authorization();
    if (error.code === "not_found") throw ApiError.notFound("contact_submission");
    if (error.code === "conflict" || error.code === "retention_locked") {
      throw ApiError.conflict({ resource: "contact_submission" });
    }
    throw ApiError.validation([
      {
        code: error.code,
        message: "The contact-submission update is not accepted.",
        path: [],
      },
    ]);
  }
  if (error instanceof ContactRepositoryConflictError) {
    throw ApiError.conflict({ resource: "contact_submission" });
  }
  throw error;
}
