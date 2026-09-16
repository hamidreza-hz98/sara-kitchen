import "server-only";

import { createHmac } from "node:crypto";
import { isIP } from "node:net";

import type { Connection } from "mongoose";

import { getServerEnvironment } from "@/server/environment";
import { ApiError } from "@/server/http/api-error";

import { getSignupLimitModel } from "../model/signup-limit";

const WINDOW_MS = 60 * 60 * 1_000;
const IP_LIMIT = 30;
const IDENTITY_LIMIT = 5;

function keyHash(scope: string, value: string, windowStart: number): string {
  return createHmac("sha256", getServerEnvironment().AUTH_SESSION_SECRET)
    .update(`signup:${scope}:${windowStart}:${value}`)
    .digest("hex");
}

function clientAddress(request: Request): string {
  // Vercel overwrites X-Forwarded-For; other production proxies must do the same.
  const value = request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() ?? "";
  return isIP(value) ? value : "unknown";
}

async function increment(connection: Connection, scope: string, value: string, limit: number) {
  const now = Date.now();
  const windowStart = Math.floor(now / WINDOW_MS) * WINDOW_MS;
  const key = keyHash(scope, value, windowStart);
  const model = getSignupLimitModel(connection);
  const update = {
    $inc: { count: 1 },
    $setOnInsert: { expiresAt: new Date(windowStart + 2 * WINDOW_MS) },
  };
  let record;
  try {
    record = await model.findOneAndUpdate({ keyHash: key }, update, {
      upsert: true,
      returnDocument: "after",
    });
  } catch (error) {
    if (typeof error !== "object" || error === null || !("code" in error) || error.code !== 11_000)
      throw error;
    record = await model.findOneAndUpdate(
      { keyHash: key },
      { $inc: { count: 1 } },
      { returnDocument: "after" },
    );
  }
  if (!record || record.count > limit) {
    throw ApiError.rateLimit(Math.max(1, Math.ceil((windowStart + WINDOW_MS - now) / 1_000)));
  }
}

/** Call before JSON parsing and hashing, then after normalized identity validation. */
export async function limitSignupIp(connection: Connection, request: Request): Promise<void> {
  await increment(connection, "ip", clientAddress(request), IP_LIMIT);
}

export async function limitSignupIdentity(connection: Connection, mobile: string): Promise<void> {
  await increment(connection, "mobile", mobile, IDENTITY_LIMIT);
}
