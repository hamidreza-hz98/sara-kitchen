import type { NextRequest } from "next/server";
import { z } from "zod";

import { SUPPORTED_LOCALES } from "@/constants";
import { connectToDatabase } from "@/server/database";
import { getServerEnvironment } from "@/server/environment";
import { ApiError, apiSuccess, handleApiRoute } from "@/server/http";
import { recordOperationalMetric } from "@/server/metrics";
import {
  AuthorizationGuardError,
  adminCookieName,
  isProtectedMutation,
  requireAdminActor,
} from "@/server/modules/auth";
import { recordAuditEvent } from "@/server/modules/logs";
import {
  INLINE_PROCESSING_POLICY,
  ImageProcessingError,
  MediaUploadError,
  StorageError,
  UploadPolicyError,
  createMediaUpload,
  createMediaUploadRepository,
  createMinioStorageProvider,
} from "@/server/modules/media";

export const runtime = "nodejs";
export const maxDuration = 15;

const translationSchema = z
  .array(
    z.strictObject({
      locale: z.enum(SUPPORTED_LOCALES),
      alt: z.string().trim().min(1).max(500),
    }),
  )
  .min(1)
  .max(SUPPORTED_LOCALES.length);

function fileError(code: string): ApiError {
  return ApiError.validation([
    { code, message: "The media file is not accepted.", path: ["file"] },
  ]);
}

async function readBoundedForm(request: Request): Promise<FormData> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^multipart\/form-data(?:;|$)/iu.test(contentType)) throw fileError("invalid_content_type");
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > INLINE_PROCESSING_POLICY.maxRouteBodyBytes) {
    throw fileError("request_too_large");
  }
  if (!request.body) throw fileError("empty_body");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > INLINE_PROCESSING_POLICY.maxRouteBodyBytes) {
        await reader.cancel();
        throw fileError("request_too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return await new Response(Buffer.concat(chunks), {
      headers: { "content-type": contentType },
    }).formData();
  } catch {
    throw fileError("invalid_multipart");
  }
}

function parseForm(form: FormData) {
  const files = form.getAll("file");
  const translationsValue = form.get("translations");
  if (files.length !== 1 || !(files[0] instanceof File)) throw fileError("single_file_required");
  if (typeof translationsValue !== "string") throw fileError("translations_required");
  let parsed: unknown;
  try {
    parsed = JSON.parse(translationsValue);
  } catch {
    throw fileError("invalid_translations");
  }
  const translations = translationSchema.safeParse(parsed);
  if (!translations.success) throw fileError("invalid_translations");
  return { file: files[0], translations: translations.data };
}

function translateUploadError(error: unknown): never {
  if (error instanceof UploadPolicyError) throw fileError(error.code);
  if (error instanceof ImageProcessingError) {
    if (error.code === "processing_busy") throw ApiError.rateLimit(5);
    throw fileError(error.code);
  }
  if (error instanceof MediaUploadError) {
    if (error.code === "duplicate") throw ApiError.conflict({ field: "file", resource: "media" });
    if (error.code !== "rollback_failed") throw fileError(error.code);
  }
  if (error instanceof StorageError && error.code === "unavailable") {
    throw ApiError.unavailable({ mongodb: "ready", objectStorage: "unavailable" });
  }
  throw error;
}

function uploadFailureReason(error: unknown): "validation" | "storage" | "processing" | "unknown" {
  if (error instanceof UploadPolicyError || error instanceof MediaUploadError) return "validation";
  if (error instanceof ImageProcessingError) return "processing";
  if (error instanceof StorageError) return "storage";
  return "unknown";
}

export async function POST(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const token = request.cookies.get(adminCookieName())?.value;
    if (!token) throw ApiError.authentication();
    if (!isProtectedMutation(request, "admin", token)) throw ApiError.authorization();
    const connection = await connectToDatabase();
    let actor;
    try {
      actor = await requireAdminActor(connection, token, "media:create");
    } catch (error) {
      if (error instanceof AuthorizationGuardError) {
        throw error.reason === "unauthenticated"
          ? ApiError.authentication()
          : ApiError.authorization();
      }
      throw error;
    }
    const { file, translations } = parseForm(await readBoundedForm(request));
    let result;
    try {
      result = await createMediaUpload(
        {
          repository: createMediaUploadRepository(connection),
          storage: createMinioStorageProvider(),
        },
        {
          actorId: actor.id,
          bucket: getServerEnvironment().MINIO_BUCKET,
          candidate: { name: file.name, blob: file },
          translations,
        },
      );
    } catch (error) {
      recordOperationalMetric({
        name: "media.upload.failure",
        value: 1,
        unit: "count",
        reason: uploadFailureReason(error),
        requestId,
      });
      translateUploadError(error);
    }
    await recordAuditEvent(connection, {
      action: "crud.resource.create",
      actor: {
        kind: "admin",
        ref: actor.id,
        snapshot: { displayName: actor.displayName, role: actor.role },
      },
      resource: {
        kind: "media",
        ref: result.id,
        snapshot: { code: null, label: null, status: "ready" },
      },
      outcome: "success",
      requestId,
      context: { variantCount: result.variantCount },
      network: { policy: "omitted", ipHash: null, ipAddress: null },
      userAgent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
    }).catch(() => undefined);
    return apiSuccess(result, { status: 201 });
  });
}
