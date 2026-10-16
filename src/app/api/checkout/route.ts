import type { NextRequest } from "next/server";
import { z } from "zod";

import {
  ApiError,
  apiSuccess,
  getRequestValidationOptions,
  handleApiRoute,
  parseJsonRequest,
} from "@/server/http";
import { getServerEnvironment } from "@/server/environment";
import { isSameOriginMutation } from "@/server/modules/auth";
import { getLocalMbWaySandboxProvider } from "@/server/modules/transactions";
import { submitAtomicCheckout } from "@/server/modules/orders";
import { revalidateDashboardFromRoute } from "@/server/cache/dashboard-revalidation";

import { cartRequestContext, cartRequestLocale } from "../cart/route-helper";

export const runtime = "nodejs";

const submissionSchema = z.strictObject({
  expectedCartVersion: z.number().int().min(1),
  paymentMethod: z.literal("mbway"),
  paymentPhone: z.string().trim().min(9).max(32),
  acceptedPolicies: z
    .array(
      z.strictObject({ id: z.string().regex(/^[a-f\d]{24}$/iu), version: z.number().int().min(1) }),
    )
    .length(2),
});
const KEY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/u;

export async function POST(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, async () => {
    if (!isSameOriginMutation(request)) throw ApiError.authorization();
    const locale = cartRequestLocale(request);
    const submission = await parseJsonRequest(
      request,
      submissionSchema,
      await getRequestValidationOptions(locale),
    );
    const context = await cartRequestContext(request, { createGuest: false, mutation: true });
    if (context.identity?.kind !== "customer") throw ApiError.authentication();
    const key = request.headers.get("idempotency-key") ?? "";
    if (!KEY_PATTERN.test(key))
      throw ApiError.validation([
        {
          code: "invalid_idempotency_key",
          message: "Supply a stable Idempotency-Key header.",
          path: ["idempotencyKey"],
        },
      ]);
    const environment = getServerEnvironment();
    // The local simulator is intentionally unavailable in production; real PSP transport is a separate release gate.
    if (
      process.env.NODE_ENV === "production" ||
      !environment.MBWAY_ENABLED ||
      !environment.MBWAY_WEBHOOK_SECRET
    )
      throw ApiError.serviceUnavailable();
    const result = await submitAtomicCheckout({
      connection: context.connection,
      customerId: context.identity.customerId,
      locale,
      idempotencyKey: key,
      submission,
      deliveryBands: [
        { maxDistanceMeters: 5_000, feeCents: 400 },
        { maxDistanceMeters: 10_000, feeCents: 600 },
        { maxDistanceMeters: 20_000, feeCents: 800 },
      ],
      kitchen: {
        latitude: environment.KITCHEN_LATITUDE,
        longitude: environment.KITCHEN_LONGITUDE,
      },
      serviceRadiusKm: null,
      provider: getLocalMbWaySandboxProvider(environment.MBWAY_WEBHOOK_SECRET),
    });
    if (!result.replayed) revalidateDashboardFromRoute();
    return apiSuccess(result, { headers: { "Cache-Control": "private, no-store" } });
  });
}
