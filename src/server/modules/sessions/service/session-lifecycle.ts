import "server-only";

import type { Connection } from "mongoose";

import {
  getSessionModel,
  type SessionActorKind,
  type SessionRevocationReason,
} from "../model/session";
import { hashSessionToken } from "./session-token";

export const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1_000;
const LAST_SEEN_WRITE_INTERVAL_MS = 5 * 60 * 1_000;

export type ResolvedSession = {
  id: string;
  actorId: string;
  actorKind: SessionActorKind;
  audience: SessionActorKind;
  passwordVersion: number;
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
  if (!session || now.getTime() - session.lastSeenAt.getTime() >= SESSION_IDLE_TIMEOUT_MS) {
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
