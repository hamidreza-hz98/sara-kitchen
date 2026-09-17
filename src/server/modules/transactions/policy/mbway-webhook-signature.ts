import { createHmac, timingSafeEqual } from "node:crypto";

const SIGNATURE_PATTERN = /^sha256=([a-f\d]{64})$/iu;
const MAX_CLOCK_SKEW_SECONDS = 5 * 60;

/**
 * Sandbox webhook envelope. Replace only this adapter if the selected MB Way
 * acquirer documents a different canonical payload or signature scheme.
 */
export function verifyMbWayWebhookSignature(input: {
  rawBody: string;
  signature: string | null;
  timestamp: string | null;
  secret: string;
  now?: Date;
}): boolean {
  if (input.secret.length < 32) return false;
  const match = input.signature?.match(SIGNATURE_PATTERN);
  if (!match?.[1] || !/^\d{10}$/u.test(input.timestamp ?? "")) return false;
  const timestamp = Number(input.timestamp);
  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1_000);
  if (!Number.isSafeInteger(timestamp) || Math.abs(nowSeconds - timestamp) > MAX_CLOCK_SKEW_SECONDS)
    return false;
  const expected = createHmac("sha256", input.secret)
    .update(`${input.timestamp}.${input.rawBody}`)
    .digest();
  const supplied = Buffer.from(match[1], "hex");
  return supplied.length === expected.length && timingSafeEqual(expected, supplied);
}
