import "server-only";

import { isValidObjectId } from "mongoose";
import type { Connection } from "mongoose";

import type { ActiveSessionPage, BrowserKind, PlatformKind } from "@/types/session";

import { getSessionModel, type SessionActorKind } from "../model/session";
import { PERSISTENT_SESSION_IDLE_TIMEOUT_MS, SESSION_IDLE_TIMEOUT_MS } from "./session-lifecycle";

const PAGE_SIZE = 20;

function browserFromAgent(agent: string | null): BrowserKind {
  if (!agent) return "other";
  if (/Edg(?:e|A|iOS)?\//u.test(agent)) return "edge";
  if (/(?:Chrome|CriOS)\//u.test(agent)) return "chrome";
  if (/(?:Firefox|FxiOS)\//u.test(agent)) return "firefox";
  if (/Safari\//u.test(agent)) return "safari";
  return "other";
}

function platformFromAgent(agent: string | null): PlatformKind {
  if (!agent) return "other";
  if (/(?:iPhone|iPad|iPod)/u.test(agent)) return "ios";
  if (/Android/u.test(agent)) return "android";
  if (/Windows/u.test(agent)) return "windows";
  if (/(?:Macintosh|Mac OS X)/u.test(agent)) return "macos";
  if (/Linux/u.test(agent)) return "linux";
  return "other";
}

export async function listActiveActorSessions(
  connection: Connection,
  actorKind: SessionActorKind,
  actorId: string,
  passwordVersion: number,
  currentSessionId: string,
  page = 1,
  now = new Date(),
): Promise<ActiveSessionPage> {
  if (!isValidObjectId(actorId) || !isValidObjectId(currentSessionId))
    throw new TypeError("Invalid session actor or current session ID.");
  if (!Number.isSafeInteger(page) || page < 1 || page > 1_000)
    throw new RangeError("Session page must be between 1 and 1,000.");
  const filter = {
    actorKind,
    audience: actorKind,
    actorId,
    passwordVersion,
    revokedAt: null,
    expiresAt: { $gt: now },
    $or: [
      { persistent: false, lastSeenAt: { $gt: new Date(now.getTime() - SESSION_IDLE_TIMEOUT_MS) } },
      {
        persistent: true,
        lastSeenAt: { $gt: new Date(now.getTime() - PERSISTENT_SESSION_IDLE_TIMEOUT_MS) },
      },
    ],
  };
  const Session = getSessionModel(connection);
  const [total, records] = await Promise.all([
    Session.countDocuments(filter),
    Session.find(filter)
      .select("_id createdAt lastSeenAt expiresAt persistent userAgent")
      .sort({ lastSeenAt: -1, _id: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean()
      .exec(),
  ]);
  return {
    sessions: records.map((record) => ({
      id: record._id.toHexString(),
      current: record._id.toHexString() === currentSessionId,
      browser: browserFromAgent(record.userAgent),
      platform: platformFromAgent(record.userAgent),
      createdAt: record.createdAt.toISOString(),
      lastSeenAt: record.lastSeenAt.toISOString(),
      expiresAt: record.expiresAt.toISOString(),
      persistent: record.persistent,
    })),
    page,
    pageSize: PAGE_SIZE,
    total,
    hasMore: page * PAGE_SIZE < total,
  };
}

export async function revokeOwnedActorSession(
  connection: Connection,
  actorKind: SessionActorKind,
  actorId: string,
  sessionId: string,
  currentSessionId: string,
  now = new Date(),
): Promise<boolean> {
  if (!isValidObjectId(actorId) || !isValidObjectId(currentSessionId))
    throw new TypeError("Invalid session actor or current session ID.");
  if (!isValidObjectId(sessionId) || sessionId === currentSessionId) return false;
  const result = await getSessionModel(connection).updateOne(
    {
      _id: sessionId,
      actorKind,
      audience: actorKind,
      actorId,
      revokedAt: null,
    },
    { $set: { revokedAt: now, revocationReason: "security" } },
  );
  return result.matchedCount === 1;
}

export async function revokeOtherActorSessions(
  connection: Connection,
  actorKind: SessionActorKind,
  actorId: string,
  currentSessionId: string,
  now = new Date(),
): Promise<number> {
  if (!isValidObjectId(actorId) || !isValidObjectId(currentSessionId))
    throw new TypeError("Invalid session actor or current session ID.");
  const result = await getSessionModel(connection).updateMany(
    {
      _id: { $ne: currentSessionId },
      actorKind,
      audience: actorKind,
      actorId,
      revokedAt: null,
    },
    { $set: { revokedAt: now, revocationReason: "logout-all" } },
  );
  return result.modifiedCount;
}
