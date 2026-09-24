import "server-only";

import { createHmac } from "node:crypto";
import { isIP } from "node:net";

import { Types } from "mongoose";

export const BLOG_VIEW_MINIMUM_ENGAGEMENT_MS = 3_000;
export const BLOG_VIEW_DEDUPLICATION_WINDOW_MS = 6 * 60 * 60 * 1_000;
export const BLOG_VIEW_RECEIPT_RETENTION_MS = 48 * 60 * 60 * 1_000;
const BOT =
  /(?:bot|crawler|spider|slurp|preview|whatsapp|telegrambot|headless|lighthouse|curl|wget|postmanruntime)/iu;
const PREFETCH = /(?:prefetch|prerender|preview)/iu;

export type BlogViewSignal = Readonly<{
  blogId: string;
  userAgent: string | null;
  clientAddress: string | null;
  engagementMs: number;
  visibilityState: "visible" | "hidden";
  purpose?: string | null;
}>;
export type BlogViewCandidate = Readonly<{
  blogId: string;
  visitorHash: string;
  windowStartedAt: Date;
  expiresAt: Date;
}>;
export type BlogViewDecision =
  | Readonly<{ countable: false; reason: "invalid" | "bot" | "prefetch" | "not_engaged" }>
  | Readonly<{ countable: true; candidate: BlogViewCandidate }>;

function address(value: string | null): string {
  const candidate = value?.split(",", 1)[0]?.trim() ?? "";
  return isIP(candidate) ? candidate : "unknown";
}

export function evaluateBlogViewSignal(
  signal: BlogViewSignal,
  options: Readonly<{ secret: string; at?: Date }>,
): BlogViewDecision {
  const at = options.at ?? new Date();
  const userAgent = signal.userAgent?.trim() ?? "";
  if (
    !Types.ObjectId.isValid(signal.blogId) ||
    options.secret.length < 32 ||
    !Number.isFinite(at.getTime()) ||
    !userAgent ||
    userAgent.length > 512
  )
    return { countable: false, reason: "invalid" };
  if (BOT.test(userAgent)) return { countable: false, reason: "bot" };
  if (signal.purpose && PREFETCH.test(signal.purpose))
    return { countable: false, reason: "prefetch" };
  if (
    signal.visibilityState !== "visible" ||
    !Number.isSafeInteger(signal.engagementMs) ||
    signal.engagementMs < BLOG_VIEW_MINIMUM_ENGAGEMENT_MS ||
    signal.engagementMs > 24 * 60 * 60 * 1_000
  )
    return { countable: false, reason: "not_engaged" };
  const windowStart =
    Math.floor(at.getTime() / BLOG_VIEW_DEDUPLICATION_WINDOW_MS) *
    BLOG_VIEW_DEDUPLICATION_WINDOW_MS;
  return {
    countable: true,
    candidate: {
      blogId: signal.blogId.toLowerCase(),
      visitorHash: createHmac("sha256", options.secret)
        .update(
          `blog-view:v1:${windowStart}:${address(signal.clientAddress)}:${userAgent.toLocaleLowerCase("en-US")}`,
        )
        .digest("hex"),
      windowStartedAt: new Date(windowStart),
      expiresAt: new Date(windowStart + BLOG_VIEW_RECEIPT_RETENTION_MS),
    },
  };
}
