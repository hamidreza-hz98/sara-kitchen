import "server-only";

import { z } from "zod";

import { verifyMbWayWebhookSignature } from "../policy/mbway-webhook-signature";

export const MBWAY_SANDBOX_WEBHOOK_MAX_BYTES = 4_096;

const safeReference = z
  .string()
  .min(1)
  .max(128)
  .regex(/^(?!.*\d{12,})[A-Za-z0-9._:-]+$/u);
const safeResponseCode = z
  .string()
  .min(1)
  .max(64)
  .regex(/^(?!.*\d{12,})[A-Z0-9_:-]+$/u);

const webhookSchema = z.strictObject({
  paymentId: safeReference,
  eventId: safeReference,
  code: z.enum(["PENDING", "AUTHORIZED", "PAID", "FAILED", "CANCELLED", "EXPIRED", "REFUNDED"]),
  amountCents: z.number().int().nonnegative().safe().nullable(),
  responseCode: safeResponseCode.nullable(),
  occurredAt: z.iso.datetime(),
});

export type VerifiedMbWaySandboxEvent = {
  paymentId: string;
  eventId: string;
  code: z.infer<typeof webhookSchema>["code"];
  amountCents: number | null;
  responseCode: string | null;
  occurredAt: Date;
};

/** Authenticate the exact bytes before parsing; never return raw bodies or signatures. */
export function verifyAndParseMbWaySandboxWebhook(input: {
  rawBody: string;
  signature: string | null;
  timestamp: string | null;
  secret: string;
  now?: Date;
}): VerifiedMbWaySandboxEvent | null {
  if (Buffer.byteLength(input.rawBody, "utf8") > MBWAY_SANDBOX_WEBHOOK_MAX_BYTES) return null;
  if (!verifyMbWayWebhookSignature(input)) return null;
  try {
    const parsed = webhookSchema.safeParse(JSON.parse(input.rawBody) as unknown);
    if (!parsed.success) return null;
    return {
      paymentId: parsed.data.paymentId,
      eventId: parsed.data.eventId,
      code: parsed.data.code,
      amountCents: parsed.data.amountCents,
      responseCode: parsed.data.responseCode,
      occurredAt: new Date(parsed.data.occurredAt),
    };
  } catch {
    return null;
  }
}
