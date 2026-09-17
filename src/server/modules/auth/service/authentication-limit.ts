import "server-only";

import { createHmac } from "node:crypto";
import { isIP } from "node:net";

import type { Connection } from "mongoose";

import { normalizeAdminIdentifier } from "@/server/modules/admins";
import { normalizeCustomerEmail, normalizeCustomerMobile } from "@/server/modules/customers";
import { getServerEnvironment } from "@/server/environment";
import { ApiError } from "@/server/http/api-error";

import { getAuthenticationLimitModel } from "../model/authentication-limit";
import type { SessionPrincipal } from "./actor-sessions";

const FIFTEEN_MINUTES = 15 * 60 * 1_000;
const ONE_HOUR = 60 * 60 * 1_000;

export function trustedClientAddress(request: Request): string {
  // The deployment proxy must overwrite X-Forwarded-For, never append client input.
  const value = request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() ?? "";
  return isIP(value) ? value : "unknown";
}

function digest(scope: string, value: string, windowStart: number): string {
  return createHmac("sha256", getServerEnvironment().AUTH_SESSION_SECRET)
    .update(`authentication-limit:v1:${scope}:${windowStart}:${value}`)
    .digest("hex");
}

async function consume(
  connection: Connection,
  input: { scope: string; value: string; limit: number; windowMs: number },
): Promise<void> {
  const now = Date.now();
  const windowStart = Math.floor(now / input.windowMs) * input.windowMs;
  const keyHash = digest(input.scope, input.value, windowStart);
  const model = getAuthenticationLimitModel(connection);
  const update = {
    $inc: { count: 1 },
    $setOnInsert: { expiresAt: new Date(windowStart + 2 * input.windowMs) },
  };
  let record;
  try {
    record = await model.findOneAndUpdate({ keyHash }, update, {
      upsert: true,
      returnDocument: "after",
    });
  } catch (error) {
    if (typeof error !== "object" || error === null || !("code" in error) || error.code !== 11_000)
      throw error;
    record = await model.findOneAndUpdate(
      { keyHash },
      { $inc: { count: 1 } },
      { returnDocument: "after" },
    );
  }
  if (!record || record.count > input.limit) {
    const remaining = Math.max(1, Math.ceil((windowStart + input.windowMs - now) / 1_000));
    // Round up to a minute: predictable for clients without exposing precise bucket timing.
    throw ApiError.rateLimit(Math.ceil(remaining / 60) * 60);
  }
}

function customerIdentifier(value: string): string {
  return (
    (value.includes("@") ? normalizeCustomerEmail(value) : normalizeCustomerMobile(value)) ??
    value.trim().toLowerCase()
  );
}

export async function limitAdminLogin(
  connection: Connection,
  request: Request,
  identifier: string,
): Promise<void> {
  await consume(connection, {
    scope: "admin-login-ip",
    value: trustedClientAddress(request),
    limit: 20,
    windowMs: FIFTEEN_MINUTES,
  });
  await consume(connection, {
    scope: "admin-login-identifier",
    value: normalizeAdminIdentifier(identifier),
    limit: 7,
    windowMs: FIFTEEN_MINUTES,
  });
}

export async function limitCustomerLogin(
  connection: Connection,
  request: Request,
  identifier: string,
): Promise<void> {
  await consume(connection, {
    scope: "customer-login-ip",
    value: trustedClientAddress(request),
    limit: 40,
    windowMs: FIFTEEN_MINUTES,
  });
  await consume(connection, {
    scope: "customer-login-identifier",
    value: customerIdentifier(identifier),
    limit: 10,
    windowMs: FIFTEEN_MINUTES,
  });
}

/** Reserved for the email/mobile verification endpoint; consume before identity lookup. */
export async function limitVerificationAttempt(
  connection: Connection,
  request: Request,
  identifier: string,
): Promise<void> {
  await consume(connection, {
    scope: "verification-ip",
    value: trustedClientAddress(request),
    limit: 20,
    windowMs: ONE_HOUR,
  });
  await consume(connection, {
    scope: "verification-identifier",
    value: customerIdentifier(identifier),
    limit: 6,
    windowMs: ONE_HOUR,
  });
}

export async function limitSensitiveAccountOperation(
  connection: Connection,
  request: Request,
  input: {
    principal: SessionPrincipal;
    actorId: string;
    operation: "change-password" | "sessions";
  },
): Promise<void> {
  const policy =
    input.operation === "change-password"
      ? { actor: 5, ip: 20, windowMs: ONE_HOUR }
      : { actor: 30, ip: 60, windowMs: FIFTEEN_MINUTES };
  const prefix = `${input.principal}-${input.operation}`;
  await consume(connection, {
    scope: `${prefix}-ip`,
    value: trustedClientAddress(request),
    limit: policy.ip,
    windowMs: policy.windowMs,
  });
  await consume(connection, {
    scope: `${prefix}-actor`,
    value: input.actorId,
    limit: policy.actor,
    windowMs: policy.windowMs,
  });
}

export async function limitPasswordResetToken(
  connection: Connection,
  token: string,
): Promise<void> {
  await consume(connection, {
    scope: "password-reset-token",
    value: token,
    limit: 8,
    windowMs: ONE_HOUR,
  });
}
