import { createHash } from "node:crypto";

import { z } from "zod";
import type { ClientSession, Connection } from "mongoose";

import { withMongoTransaction } from "@/server/database/transaction-boundary";
import { ApiError } from "@/server/http/api-error";

import {
  completeIdempotencyRecord,
  createPendingIdempotencyRecord,
  findIdempotencyRecord,
} from "../repository/idempotency-repository";

const MIN_RETENTION_MS = 24 * 60 * 60 * 1000;
const MAX_RETENTION_MS = 30 * MIN_RETENTION_MS;
const MAX_JSON_BYTES = 64 * 1024;

const identitySchema = z.strictObject({
  scope: z.enum(["checkout", "payment", "webhook"]),
  subject: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z0-9._:-]+$/u),
  key: z
    .string()
    .min(8)
    .max(128)
    .regex(/^[A-Za-z0-9._:-]+$/u),
  retentionMs: z.number().int().min(MIN_RETENTION_MS).max(MAX_RETENTION_MS),
});

export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export type IdempotencyInput<Result extends JsonValue> = z.input<typeof identitySchema> & {
  connection: Connection;
  request: JsonValue;
  execute: (session: ClientSession) => Promise<Result>;
  messages?: { conflict: string; processing: string };
};

export type IdempotencyOutcome<Result extends JsonValue> = {
  result: Result;
  replayed: boolean;
};

function canonicalJson(value: JsonValue, depth = 0): string {
  if (depth > 30) throw new TypeError("Idempotency JSON exceeds maximum nesting depth.");
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      throw new TypeError("Idempotency JSON must contain finite numbers.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item, depth + 1)).join(",")}]`;
  }
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    throw new TypeError("Idempotency JSON must contain plain objects.");
  }
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key]!, depth + 1)}`)
    .join(",")}}`;
}

function boundedJson(value: JsonValue): string {
  const serialized = canonicalJson(value);
  if (Buffer.byteLength(serialized, "utf8") > MAX_JSON_BYTES) {
    throw new RangeError("Idempotency JSON exceeds the 64 KiB limit.");
  }
  return serialized;
}

export function fingerprintRequest(request: JsonValue): string {
  return createHash("sha256").update(boundedJson(request)).digest("hex");
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

function conflict(message?: string): ApiError {
  return ApiError.conflict({
    field: "idempotencyKey",
    ...(message ? { publicMessage: message } : {}),
  });
}

/**
 * Persist a replayable result with the business writes in one transaction.
 * The callback must only perform session-bound database work, never external I/O.
 */
export async function runIdempotentOperation<Result extends JsonValue>(
  input: IdempotencyInput<Result>,
): Promise<IdempotencyOutcome<Result>> {
  const { scope, subject, key, retentionMs } = identitySchema.parse({
    scope: input.scope,
    subject: input.subject,
    key: input.key,
    retentionMs: input.retentionMs,
  });
  const fingerprint = fingerprintRequest(input.request);
  const selector = { scope, subject, key };

  const replay = async (): Promise<IdempotencyOutcome<Result> | null> => {
    const existing = await findIdempotencyRecord(input.connection, selector);
    if (!existing) return null;
    if (existing.fingerprint !== fingerprint) throw conflict(input.messages?.conflict);
    if (existing.status !== "completed") {
      throw ApiError.conflict({
        field: "idempotencyKey",
        ...(input.messages?.processing ? { publicMessage: input.messages.processing } : {}),
      });
    }
    if (typeof existing.result !== "string")
      throw new Error("Completed idempotency result is missing.");
    return { result: JSON.parse(existing.result) as Result, replayed: true };
  };

  const previous = await replay();
  if (previous) return previous;

  try {
    return await withMongoTransaction(input.connection, async (session) => {
      const expiresAt = new Date(Date.now() + retentionMs);
      await createPendingIdempotencyRecord(
        input.connection,
        selector,
        fingerprint,
        expiresAt,
        session,
      );
      const serializedResult = boundedJson(await input.execute(session));
      await completeIdempotencyRecord(input.connection, selector, serializedResult, session);
      return { result: JSON.parse(serializedResult) as Result, replayed: false };
    });
  } catch (error) {
    if (isDuplicateKey(error)) {
      const previousAfterRace = await replay();
      if (previousAfterRace) return previousAfterRace;
    }
    throw error;
  }
}
