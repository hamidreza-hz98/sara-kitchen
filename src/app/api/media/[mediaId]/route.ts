import type { NextRequest } from "next/server";
import { z } from "zod";

import { LOCALE_COOKIE_NAME, resolveLocalePreference } from "@/locales/routing";
import { connectToDatabase } from "@/server/database";
import {
  ApiError,
  apiSuccess,
  getRequestValidationOptions,
  handleApiRoute,
  parseJsonRequest,
  parseQueryParameters,
  parseRouteParameters,
} from "@/server/http";
import {
  AuthorizationGuardError,
  adminCookieName,
  isProtectedMutation,
  requireAdminActor,
} from "@/server/modules/auth";
import { recordAuditEvent } from "@/server/modules/logs";
import {
  MediaDeleteError,
  MediaUpdateError,
  createMediaDeleteRepository,
  createMediaReadRepository,
  createMediaUpdateRepository,
  createMinioStorageProvider,
  deleteMediaSafely,
  getMediaDetail,
  updateMediaMetadata,
} from "@/server/modules/media";
import { SUPPORTED_LOCALES } from "@/constants";
import { addLocalizedIssue } from "@/validations/request";

import { requireMediaReadConnection, rethrowMediaReadError } from "../read-helper";

const parametersSchema = z.strictObject({
  mediaId: z.string().regex(/^[a-f\d]{24}$/iu),
});
const deleteQuerySchema = z.strictObject({});
const translationSchema = z.strictObject({
  locale: z.enum(SUPPORTED_LOCALES),
  alt: z.string().trim().min(1).max(500),
});
const updateSchema = z
  .strictObject({
    originalName: z
      .string()
      .trim()
      .min(3)
      .max(180)
      .regex(/^[\p{L}\p{N}][\p{L}\p{N} _-]*\.[a-zA-Z0-9]+$/u)
      .optional(),
    translations: z.array(translationSchema).min(1).max(SUPPORTED_LOCALES.length).optional(),
  })
  .superRefine((value, context) => {
    if (value.originalName === undefined && value.translations === undefined) {
      addLocalizedIssue(context, { key: "required", path: [] });
    }
    if (value.translations) {
      const locales = value.translations.map((translation) => translation.locale);
      if (new Set(locales).size !== locales.length || !locales.includes("en")) {
        addLocalizedIssue(context, { key: "invalidChoice", path: ["translations"] });
      }
    }
  });

type RouteContext = { params: Promise<{ mediaId: string }> };

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApiRoute(request, async () => {
    const connection = await requireMediaReadConnection(request);
    const locale = resolveLocalePreference(request.cookies.get(LOCALE_COOKIE_NAME)?.value);
    const { mediaId } = await parseRouteParameters(
      context.params,
      parametersSchema,
      await getRequestValidationOptions(locale),
    );
    try {
      const detail = await getMediaDetail(
        createMediaReadRepository(connection),
        createMinioStorageProvider(),
        mediaId,
      );
      if (!detail) throw ApiError.notFound("media");
      return apiSuccess(detail);
    } catch (error) {
      return rethrowMediaReadError(error);
    }
  });
}

function updateError(error: unknown): never {
  if (error instanceof MediaUpdateError) {
    if (error.code === "not_found") throw ApiError.notFound("media");
    if (error.code === "conflict") throw ApiError.conflict({ resource: "media" });
    throw ApiError.validation([
      {
        code: error.code,
        message: "The media metadata is not accepted.",
        path: [error.code === "invalid_translations" ? "translations" : "originalName"],
      },
    ]);
  }
  throw error;
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const token = request.cookies.get(adminCookieName())?.value;
    if (!token) throw ApiError.authentication();
    if (!isProtectedMutation(request, "admin", token)) throw ApiError.authorization();
    const connection = await connectToDatabase();
    let actor;
    try {
      actor = await requireAdminActor(connection, token, "media:update");
    } catch (error) {
      if (error instanceof AuthorizationGuardError) {
        throw error.reason === "unauthenticated"
          ? ApiError.authentication()
          : ApiError.authorization();
      }
      throw error;
    }
    const locale = resolveLocalePreference(request.cookies.get(LOCALE_COOKIE_NAME)?.value);
    const validation = await getRequestValidationOptions(locale);
    const [{ mediaId }, update] = await Promise.all([
      parseRouteParameters(context.params, parametersSchema, validation),
      parseJsonRequest(request, updateSchema, validation),
    ]);
    let result;
    try {
      result = await updateMediaMetadata(createMediaUpdateRepository(connection), {
        id: mediaId,
        actorId: actor.id,
        update: {
          ...(update.originalName !== undefined ? { originalName: update.originalName } : {}),
          ...(update.translations !== undefined ? { translations: update.translations } : {}),
        },
      });
    } catch (error) {
      return updateError(error);
    }
    await recordAuditEvent(connection, {
      action: "crud.resource.update",
      actor: {
        kind: "admin",
        ref: actor.id,
        snapshot: { displayName: actor.displayName, role: actor.role },
      },
      resource: {
        kind: "media",
        ref: result.id,
        snapshot: { code: null, label: null, status: null },
      },
      outcome: "success",
      requestId,
      context: {
        changedOriginalName: update.originalName !== undefined,
        changedTranslations: update.translations !== undefined,
      },
      network: { policy: "omitted", ipHash: null, ipAddress: null },
      userAgent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
    }).catch(() => undefined);
    return apiSuccess(result);
  });
}

export async function DELETE(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const token = request.cookies.get(adminCookieName())?.value;
    if (!token) throw ApiError.authentication();
    if (!isProtectedMutation(request, "admin", token)) throw ApiError.authorization();
    const connection = await connectToDatabase();
    let actor;
    try {
      actor = await requireAdminActor(connection, token, "media:delete");
    } catch (error) {
      if (error instanceof AuthorizationGuardError) {
        throw error.reason === "unauthenticated"
          ? ApiError.authentication()
          : ApiError.authorization();
      }
      throw error;
    }

    const locale = resolveLocalePreference(request.cookies.get(LOCALE_COOKIE_NAME)?.value);
    const validation = await getRequestValidationOptions(locale);
    const [{ mediaId }] = await Promise.all([
      parseRouteParameters(context.params, parametersSchema, validation),
      Promise.resolve(parseQueryParameters(request, deleteQuerySchema, validation)),
    ]);

    let result;
    try {
      result = await deleteMediaSafely(createMediaDeleteRepository(connection), {
        id: mediaId,
        actorId: actor.id,
      });
    } catch (error) {
      if (error instanceof MediaDeleteError) {
        if (error.code === "not_found") throw ApiError.notFound("media");
        throw ApiError.conflict({
          resource: "media",
          publicMessage: "Referenced media cannot be deleted.",
        });
      }
      throw error;
    }

    await recordAuditEvent(connection, {
      action: "crud.resource.delete",
      actor: {
        kind: "admin",
        ref: actor.id,
        snapshot: { displayName: actor.displayName, role: actor.role },
      },
      resource: {
        kind: "media",
        ref: result.id,
        snapshot: { code: null, label: null, status: "recycled" },
      },
      outcome: "success",
      requestId,
      context: {
        purgeEligibleAt: result.purgeEligibleAt,
        recycleWindowDays: result.recycleWindowDays,
      },
      network: { policy: "omitted", ipHash: null, ipAddress: null },
      userAgent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
    }).catch(() => undefined);

    return apiSuccess(result);
  });
}
