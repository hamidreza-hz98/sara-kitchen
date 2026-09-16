import type { ClientSession, Connection } from "mongoose";

import { getIdempotencyRecordModel } from "../model/idempotency-record";

export type IdempotencySelector = { scope: string; subject: string; key: string };

export async function findIdempotencyRecord(connection: Connection, selector: IdempotencySelector) {
  return getIdempotencyRecordModel(connection).findOne(selector).lean().exec();
}

export async function createPendingIdempotencyRecord(
  connection: Connection,
  selector: IdempotencySelector,
  fingerprint: string,
  expiresAt: Date,
  session: ClientSession,
): Promise<void> {
  await getIdempotencyRecordModel(connection).create(
    [{ ...selector, fingerprint, status: "pending", expiresAt }],
    { session },
  );
}

export async function completeIdempotencyRecord(
  connection: Connection,
  selector: IdempotencySelector,
  result: string,
  session: ClientSession,
): Promise<void> {
  const update = await getIdempotencyRecordModel(connection).updateOne(
    selector,
    { $set: { status: "completed", result } },
    { session },
  );
  if (update.matchedCount !== 1)
    throw new Error("Idempotency record vanished within a transaction.");
}
