import "server-only";

import { isValidObjectId } from "mongoose";
import type { Connection } from "mongoose";

import {
  getSessionModel,
  type SessionActorKind,
  type SessionRevocationReason,
} from "../model/session";
import { hashSessionToken } from "./session-token";

export const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1_000;
export const PERSISTENT_SESSION_IDLE_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1_000;
const LAST_SEEN_WRITE_INTERVAL_MS = 5 * 60 * 1_000;

export type ResolvedSession = {
  id: string;
  actorId: string;
  actorKind: SessionActorKind;
  audience: SessionActorKind;
  passwordVersion: number;
  persistent: boolean;
  expiresAt: Date;
};

function safeDigest(token: string): string | null {
  try {
    return hashSessionToken(token);
  } catch {
    return null;
  }
}

export async function resolveSession(
  connection: Connection,
  token: string,
  audience: SessionActorKind,
  now = new Date(),
): Promise<ResolvedSession | null> {
  const tokenHash = safeDigest(token);
  if (!tokenHash) return null;
  const Session = getSessionModel(connection);
  const session = await Session.findOne({
    tokenHash,
    audience,
    actorKind: audience,
    revokedAt: null,
    expiresAt: { $gt: now },
  })
    .lean()
    .exec();
  if (
    !session ||
    now.getTime() - session.lastSeenAt.getTime() >=
      (session.persistent ? PERSISTENT_SESSION_IDLE_TIMEOUT_MS : SESSION_IDLE_TIMEOUT_MS)
  ) {
    return null;
  }
  if (now.getTime() - session.lastSeenAt.getTime() >= LAST_SEEN_WRITE_INTERVAL_MS) {
    const touched = await Session.updateOne(
      { _id: session._id, revokedAt: null, expiresAt: { $gt: now } },
      { $set: { lastSeenAt: now } },
    );
    if (touched.matchedCount !== 1) return null;
  }
  return {
    id: session._id.toHexString(),
    actorId: session.actorId.toHexString(),
    actorKind: session.actorKind,
    audience: session.audience,
    passwordVersion: session.passwordVersion,
    persistent: session.persistent,
    expiresAt: session.expiresAt,
  };
}

export async function revokeSession(
  connection: Connection,
  token: string,
  audience: SessionActorKind,
  reason: SessionRevocationReason,
  now = new Date(),
): Promise<boolean> {
  const tokenHash = safeDigest(token);
  if (!tokenHash) return false;
  const result = await getSessionModel(connection).updateOne(
    { tokenHash, audience, actorKind: audience, revokedAt: null },
    { $set: { revokedAt: now, revocationReason: reason } },
  );
  return result.matchedCount === 1;
}

export async function revokeActorSessions(
  connection: Connection,
  actorKind: SessionActorKind,
  actorId: string,
  reason: SessionRevocationReason,
  now = new Date(),
): Promise<number> {
  if (!isValidObjectId(actorId)) throw new TypeError("Invalid session actor ID.");
  const result = await getSessionModel(connection).updateMany(
    { actorKind, audience: actorKind, actorId, revokedAt: null },
    { $set: { revokedAt: now, revocationReason: reason } },
  );
  return result.modifiedCount;
}
