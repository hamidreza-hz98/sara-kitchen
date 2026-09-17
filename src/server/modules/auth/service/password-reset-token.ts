import "server-only";

import { createHmac, randomBytes } from "node:crypto";

import { getServerEnvironment } from "@/server/environment";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/u;

export function createPasswordResetToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashPasswordResetToken(token: string): string | null {
  if (
    !TOKEN_PATTERN.test(token) ||
    Buffer.from(token, "base64url").toString("base64url") !== token ||
    Buffer.from(token, "base64url").length !== 32
  )
    return null;
  return createHmac("sha256", getServerEnvironment().AUTH_PASSWORD_RESET_SECRET)
    .update(token, "ascii")
    .digest("hex");
}
