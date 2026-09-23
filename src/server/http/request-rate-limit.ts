import "server-only";

import { createHmac } from "node:crypto";
import { isIP } from "node:net";

import type { Connection, Model } from "mongoose";

import { createBaseSchema, type BaseDocumentFields } from "@/server/database/schema";
import { getServerEnvironment } from "@/server/environment";

import { ApiError } from "./api-error";

type RequestRateLimitRecord = BaseDocumentFields & {
  keyHash: string;
  count: number;
  expiresAt: Date;
};

export type RequestRateLimitPolicy = Readonly<{
  scope: string;
  limit: number;
  windowMs: number;
}>;

const schema = createBaseSchema<RequestRateLimitRecord>(
  {
    keyHash: { type: String, required: true, select: false },
    count: { type: Number, required: true, default: 0, min: 0 },
    expiresAt: { type: Date, required: true },
  },
  { collection: "request_rate_limits" },
);
schema.index({ keyHash: 1 }, { unique: true, name: "request_rate_limit_key_unique" });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "request_rate_limit_expiry_ttl" });

function model(connection: Connection): Model<RequestRateLimitRecord> {
  return (
    (connection.models.RequestRateLimit as Model<RequestRateLimitRecord> | undefined) ??
    connection.model<RequestRateLimitRecord>("RequestRateLimit", schema)
  );
}

function trustedAddress(request: Request): string {
  const candidate = request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() ?? "";
  return isIP(candidate) ? candidate : "unknown";
}

/** Mongo-backed fixed-window limit. Keys are HMACs; raw client addresses are never persisted. */
export async function consumeRequestRateLimit(
  connection: Connection,
  request: Request,
  policy: RequestRateLimitPolicy,
): Promise<void> {
  if (
    !/^[a-z0-9-]{1,64}$/u.test(policy.scope) ||
    !Number.isSafeInteger(policy.limit) ||
    policy.limit < 1 ||
    !Number.isSafeInteger(policy.windowMs) ||
    policy.windowMs < 1_000
  ) {
    throw new TypeError("Invalid request rate-limit policy.");
  }
  const now = Date.now();
  const windowStart = Math.floor(now / policy.windowMs) * policy.windowMs;
  const keyHash = createHmac("sha256", getServerEnvironment().AUTH_SESSION_SECRET)
    .update(`request-rate-limit:v1:${policy.scope}:${windowStart}:${trustedAddress(request)}`)
    .digest("hex");
  const update = {
    $inc: { count: 1 },
    $setOnInsert: { expiresAt: new Date(windowStart + 2 * policy.windowMs) },
  };
  let record;
  try {
    record = await model(connection).findOneAndUpdate({ keyHash }, update, {
      upsert: true,
      returnDocument: "after",
    });
  } catch (error) {
    if (
      typeof error !== "object" ||
      error === null ||
      !("code" in error) ||
      error.code !== 11_000
    ) {
      throw error;
    }
    record = await model(connection).findOneAndUpdate(
      { keyHash },
      { $inc: { count: 1 } },
      { returnDocument: "after" },
    );
  }
  if (!record || record.count > policy.limit) {
    throw ApiError.rateLimit(Math.max(1, Math.ceil((windowStart + policy.windowMs - now) / 1_000)));
  }
}
