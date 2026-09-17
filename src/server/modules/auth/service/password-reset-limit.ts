import "server-only";

import { createHmac } from "node:crypto";
import { isIP } from "node:net";

import type { Connection } from "mongoose";

import { normalizeCustomerEmail, normalizeCustomerMobile } from "@/server/modules/customers";
import { getServerEnvironment } from "@/server/environment";
import { ApiError } from "@/server/http/api-error";

import { getPasswordResetLimitModel } from "../model/password-reset-limit";

const WINDOW_MS = 60 * 60 * 1_000;

function address(request: Request): string {
  // Trusted deployment proxies must overwrite X-Forwarded-For.
  const value = request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() ?? "";
  return isIP(value) ? value : "unknown";
}

async function increment(connection: Connection, scope: string, value: string, limit: number) {
  const now = Date.now();
  const windowStart = Math.floor(now / WINDOW_MS) * WINDOW_MS;
  const keyHash = createHmac("sha256", getServerEnvironment().AUTH_PASSWORD_RESET_SECRET)
    .update(`password-reset:${scope}:${windowStart}:${value}`)
    .digest("hex");
  const model = getPasswordResetLimitModel(connection);
  const update = {
    $inc: { count: 1 },
    $setOnInsert: { expiresAt: new Date(windowStart + 2 * WINDOW_MS) },
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
  if (!record || record.count > limit) {
    throw ApiError.rateLimit(Math.max(1, Math.ceil((windowStart + WINDOW_MS - now) / 1_000)));
  }
}

export async function limitPasswordResetRequest(
  connection: Connection,
  request: Request,
  identifier: string,
): Promise<void> {
  const normalized = identifier.includes("@")
    ? normalizeCustomerEmail(identifier)
    : normalizeCustomerMobile(identifier);
  await increment(connection, "request-ip", address(request), 20);
  await increment(connection, "request-identity", normalized ?? identifier.trim().toLowerCase(), 5);
}

export async function limitPasswordResetSubmission(
  connection: Connection,
  request: Request,
): Promise<void> {
  await increment(connection, "submit-ip", address(request), 30);
}
