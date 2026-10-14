import type { NextRequest } from "next/server";

import {
  apiSuccess,
  getRequestValidationOptions,
  handleApiRoute,
  parseJsonRequest,
} from "@/server/http";
import { z } from "zod";

import {
  cartClientProjection,
  cartRequestContext,
  cartRequestLocale,
  resolveCartCrud,
  translateCartError,
} from "./route-helper";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const context = await cartRequestContext(request, { createGuest: false, mutation: false });
    if (!context.identity) return apiSuccess(null);
    try {
      const result = await resolveCartCrud(
        context.connection,
        requestId,
        request.headers.get("user-agent"),
      ).get(context.identity);
      return apiSuccess(
        result
          ? await cartClientProjection(context.connection, result, cartRequestLocale(request))
          : null,
      );
    } catch (error) {
      return translateCartError(error);
    }
  });
}

const notesSchema = z.strictObject({
  expectedVersion: z.number().int().min(1),
  notes: z.string().trim().max(1_000).nullable(),
});
const clearSchema = z.strictObject({ expectedVersion: z.number().int().min(1) });

export async function PATCH(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const input = await parseJsonRequest(
      request,
      notesSchema,
      await getRequestValidationOptions(cartRequestLocale(request)),
    );
    const context = await cartRequestContext(request, { createGuest: false, mutation: true });
    if (!context.identity) return apiSuccess(null);
    try {
      const result = await resolveCartCrud(
        context.connection,
        requestId,
        request.headers.get("user-agent"),
      ).setNotes(context.identity, input.expectedVersion, input.notes);
      return apiSuccess(
        await cartClientProjection(context.connection, result, cartRequestLocale(request)),
      );
    } catch (error) {
      return translateCartError(error);
    }
  });
}

export async function DELETE(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const input = await parseJsonRequest(
      request,
      clearSchema,
      await getRequestValidationOptions(cartRequestLocale(request)),
    );
    const context = await cartRequestContext(request, { createGuest: false, mutation: true });
    if (!context.identity) return apiSuccess(null);
    try {
      const result = await resolveCartCrud(
        context.connection,
        requestId,
        request.headers.get("user-agent"),
      ).clear(context.identity, input.expectedVersion);
      return apiSuccess(
        await cartClientProjection(context.connection, result, cartRequestLocale(request)),
      );
    } catch (error) {
      return translateCartError(error);
    }
  });
}
