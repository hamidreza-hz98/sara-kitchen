import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { getServerEnvironment } from "@/server/environment";

import type { SessionPrincipal } from "../service/actor-sessions";

import { isSameOriginMutation } from "./same-origin";

const TOKEN_PATTERN = /^[a-f\d]{64}$/iu;

/** A session-bound synchronizer token: never sent in a cookie or exposed in logs. */
export function createCsrfToken(principal: SessionPrincipal, sessionToken: string): string {
  return createHmac("sha256", getServerEnvironment().AUTH_SESSION_SECRET)
    .update(`csrf:v1:${principal}:${sessionToken}`)
    .digest("hex");
}

export function verifyCsrfToken(
  principal: SessionPrincipal,
  sessionToken: string | undefined,
  supplied: string | null,
): boolean {
  if (!sessionToken || !supplied || !TOKEN_PATTERN.test(supplied)) return false;
  const expected = Buffer.from(createCsrfToken(principal, sessionToken), "hex");
  const actual = Buffer.from(supplied, "hex");
  return timingSafeEqual(expected, actual);
}

export function isProtectedMutation(
  request: Request,
  principal: SessionPrincipal,
  sessionToken: string | undefined,
): boolean {
  return (
    isSameOriginMutation(request) &&
    verifyCsrfToken(principal, sessionToken, request.headers.get("x-csrf-token"))
  );
}
