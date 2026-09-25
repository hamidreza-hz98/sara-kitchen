import type { NextRequest } from "next/server";
import { z } from "zod";

import { apiSuccess, handleApiRoute, parseRouteParameters } from "@/server/http";
import { MUTABLE_SETTINGS_SECTION_KEYS } from "@/server/modules/settings";

import {
  resolveSettingsRuntime,
  settingsRequestContext,
  translateSettingsError,
} from "../../route-helper";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ section: string }> };
const parametersSchema = z.object({ section: z.enum(MUTABLE_SETTINGS_SECTION_KEYS) }).strict();

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await settingsRequestContext(
      request,
      "settings:read",
      true,
    );
    const { section } = await parseRouteParameters(context.params, parametersSchema, validation);
    try {
      return apiSuccess(
        await resolveSettingsRuntime(connection, requestId, request).publish(
          { id: actor.id, role: actor.role },
          section,
        ),
      );
    } catch (error) {
      return translateSettingsError(error);
    }
  });
}
