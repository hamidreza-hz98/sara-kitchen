import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { Types } from "mongoose";

export const BLOG_PREVIEW_TOKEN_LIFETIME_MS = 15 * 60 * 1_000;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/u;

type PreviewPayload = Readonly<{ blogId: string; expiresAt: number; version: number }>;

function signature(encodedPayload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(`blog-preview:v1:${encodedPayload}`).digest();
}

function payload(value: string): PreviewPayload | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("blogId" in parsed) ||
      !("expiresAt" in parsed) ||
      !("version" in parsed) ||
      typeof parsed.blogId !== "string" ||
      !Types.ObjectId.isValid(parsed.blogId) ||
      typeof parsed.expiresAt !== "number" ||
      !Number.isSafeInteger(parsed.expiresAt) ||
      typeof parsed.version !== "number" ||
      !Number.isSafeInteger(parsed.version) ||
      parsed.version < 0
    ) {
      return null;
    }
    return {
      blogId: parsed.blogId.toLowerCase(),
      expiresAt: parsed.expiresAt,
      version: parsed.version,
    };
  } catch {
    return null;
  }
}

export function issueBlogPreviewToken(
  binding: Readonly<{ blogId: string; version: number }>,
  secret: string,
  options: Readonly<{ at?: Date; lifetimeMs?: number }> = {},
): string {
  const at = options.at ?? new Date();
  const lifetimeMs = options.lifetimeMs ?? BLOG_PREVIEW_TOKEN_LIFETIME_MS;
  if (
    !Types.ObjectId.isValid(binding.blogId) ||
    !Number.isSafeInteger(binding.version) ||
    binding.version < 0 ||
    secret.length < 32 ||
    !Number.isSafeInteger(lifetimeMs) ||
    lifetimeMs < 60_000 ||
    lifetimeMs > BLOG_PREVIEW_TOKEN_LIFETIME_MS ||
    !Number.isFinite(at.getTime())
  ) {
    throw new TypeError("Invalid blog preview-token input.");
  }
  const encoded = Buffer.from(
    JSON.stringify({
      blogId: binding.blogId.toLowerCase(),
      expiresAt: at.getTime() + lifetimeMs,
      version: binding.version,
    }),
  ).toString("base64url");
  return `${encoded}.${signature(encoded, secret).toString("base64url")}`;
}

export function verifyBlogPreviewToken(
  token: string | null | undefined,
  binding: Readonly<{ blogId: string; version: number }>,
  secret: string,
  at = new Date(),
): boolean {
  if (
    !token ||
    !TOKEN_PATTERN.test(token) ||
    secret.length < 32 ||
    !Number.isFinite(at.getTime())
  ) {
    return false;
  }
  const [encoded = "", supplied = ""] = token.split(".");
  const suppliedSignature = Buffer.from(supplied, "base64url");
  const expected = signature(encoded, secret);
  if (
    suppliedSignature.length !== expected.length ||
    !timingSafeEqual(suppliedSignature, expected)
  ) {
    return false;
  }
  const decoded = payload(encoded);
  return Boolean(
    decoded &&
    decoded.expiresAt > at.getTime() &&
    decoded.blogId === binding.blogId.toLowerCase() &&
    decoded.version === binding.version,
  );
}
