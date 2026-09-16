import "server-only";

import { createHash, randomBytes } from "node:crypto";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/u;

/** 256-bit bearer secret. The caller alone may place it in an HttpOnly cookie. */
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  if (
    !TOKEN_PATTERN.test(token) ||
    Buffer.from(token, "base64url").length !== 32 ||
    Buffer.from(token, "base64url").toString("base64url") !== token
  ) {
    throw new TypeError("Malformed session token.");
  }
  return createHash("sha256").update(token, "ascii").digest("hex");
}
