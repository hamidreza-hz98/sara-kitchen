import "server-only";

import { createHmac } from "node:crypto";
import { isIP } from "node:net";

import { Types } from "mongoose";

export const DISH_VIEW_MINIMUM_ENGAGEMENT_MS = 3_000;
export const DISH_VIEW_DEDUPLICATION_WINDOW_MS = 6 * 60 * 60 * 1_000;
export const DISH_VIEW_RECEIPT_RETENTION_MS = 48 * 60 * 60 * 1_000;
export const DISH_VIEW_USER_AGENT_MAX_LENGTH = 512;

const BOT_USER_AGENT =
  /(?:bot|crawler|spider|slurp|bingpreview|facebookexternalhit|whatsapp|telegrambot|discordbot|headless|lighthouse|pagespeed|pingdom|uptimerobot|monitoring|curl|wget|python-requests|postmanruntime)/iu;
const PREFETCH_PURPOSE = /(?:prefetch|prerender|preview)/iu;

export type DishViewSignal = Readonly<{
  dishId: string;
  userAgent: string | null;
  clientAddress: string | null;
  engagementMs: number;
  visibilityState: "visible" | "hidden";
  purpose?: string | null;
}>;

export type DishViewCandidate = Readonly<{
  dishId: string;
  visitorHash: string;
  windowStartedAt: Date;
  expiresAt: Date;
}>;

export type DishViewDecision =
  | Readonly<{ countable: false; reason: "invalid" | "bot" | "prefetch" | "not_engaged" }>
  | Readonly<{ countable: true; candidate: DishViewCandidate }>;

function normalizedAddress(value: string | null): string {
  const candidate = value?.split(",", 1)[0]?.trim() ?? "";
  return isIP(candidate) ? candidate : "unknown";
}

/**
 * Convert a client engagement signal to a privacy-safe, windowed counting candidate. Raw network
 * and user-agent values are used only in-memory and are never returned or persisted.
 */
export function evaluateDishViewSignal(
  signal: DishViewSignal,
  options: Readonly<{ secret: string; at?: Date }>,
): DishViewDecision {
  const at = options.at ?? new Date();
  const userAgent = signal.userAgent?.trim() ?? "";
  if (
    !Types.ObjectId.isValid(signal.dishId) ||
    options.secret.length < 32 ||
    !Number.isFinite(at.getTime()) ||
    userAgent.length === 0 ||
    userAgent.length > DISH_VIEW_USER_AGENT_MAX_LENGTH
  ) {
    return { countable: false, reason: "invalid" };
  }
  if (BOT_USER_AGENT.test(userAgent)) return { countable: false, reason: "bot" };
  if (signal.purpose && PREFETCH_PURPOSE.test(signal.purpose)) {
    return { countable: false, reason: "prefetch" };
  }
  if (
    signal.visibilityState !== "visible" ||
    !Number.isSafeInteger(signal.engagementMs) ||
    signal.engagementMs < DISH_VIEW_MINIMUM_ENGAGEMENT_MS ||
    signal.engagementMs > 24 * 60 * 60 * 1_000
  ) {
    return { countable: false, reason: "not_engaged" };
  }

  const windowStartMs =
    Math.floor(at.getTime() / DISH_VIEW_DEDUPLICATION_WINDOW_MS) *
    DISH_VIEW_DEDUPLICATION_WINDOW_MS;
  const visitorHash = createHmac("sha256", options.secret)
    .update(
      `dish-view:v1:${windowStartMs}:${normalizedAddress(signal.clientAddress)}:${userAgent.toLocaleLowerCase("en-US")}`,
    )
    .digest("hex");
  return {
    countable: true,
    candidate: {
      dishId: signal.dishId.toLowerCase(),
      visitorHash,
      windowStartedAt: new Date(windowStartMs),
      expiresAt: new Date(windowStartMs + DISH_VIEW_RECEIPT_RETENTION_MS),
    },
  };
}
