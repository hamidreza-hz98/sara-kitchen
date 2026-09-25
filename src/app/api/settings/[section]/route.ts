import type { NextRequest } from "next/server";
import { z } from "zod";

import { apiSuccess, handleApiRoute, parseJsonRequest, parseRouteParameters } from "@/server/http";
import {
  MUTABLE_SETTINGS_SECTION_KEYS,
  type MutableSettingsSectionKey,
} from "@/server/modules/settings";

import {
  resolveSettingsRuntime,
  settingsRequestContext,
  translateSettingsError,
} from "../route-helper";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ section: string }> };

const parametersSchema = z.object({ section: z.enum(MUTABLE_SETTINGS_SECTION_KEYS) }).strict();
const payloadSchema = z
  .object({ data: z.record(z.string(), z.unknown()), translations: z.array(z.unknown()) })
  .strict();

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await settingsRequestContext(
      request,
      "settings:read",
    );
    const { section } = await parseRouteParameters(context.params, parametersSchema, validation);
    try {
      return apiSuccess(
        await resolveSettingsRuntime(connection, requestId, request).getAdmin(
          { id: actor.id, role: actor.role },
          section as MutableSettingsSectionKey,
        ),
      );
    } catch (error) {
      return translateSettingsError(error);
    }
  });
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor, validation } = await settingsRequestContext(
      request,
      "settings:read",
      true,
    );
    const [{ section }, payload] = await Promise.all([
      parseRouteParameters(context.params, parametersSchema, validation),
      parseJsonRequest(request, payloadSchema, validation),
    ]);
    try {
      return apiSuccess(
        await resolveSettingsRuntime(connection, requestId, request).update(
          { id: actor.id, role: actor.role },
          section as MutableSettingsSectionKey,
          payload,
        ),
      );
    } catch (error) {
      return translateSettingsError(error);
    }
  });
}
