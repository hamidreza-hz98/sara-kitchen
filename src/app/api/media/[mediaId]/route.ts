import type { NextRequest } from "next/server";
import { z } from "zod";

import { LOCALE_COOKIE_NAME, resolveLocalePreference } from "@/locales/routing";
import {
  ApiError,
  apiSuccess,
  getRequestValidationOptions,
  handleApiRoute,
  parseRouteParameters,
} from "@/server/http";
import {
  createMediaReadRepository,
  createMinioStorageProvider,
  getMediaDetail,
} from "@/server/modules/media";

import { requireMediaReadConnection, rethrowMediaReadError } from "../read-helper";

const parametersSchema = z.strictObject({
  mediaId: z.string().regex(/^[a-f\d]{24}$/iu),
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
