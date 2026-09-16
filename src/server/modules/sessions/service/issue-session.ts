import "server-only";

import { isIP } from "node:net";

import { isValidObjectId } from "mongoose";
import type { Connection, Types } from "mongoose";

import { getSessionModel, type SessionActorKind } from "../model/session";
import { generateSessionToken, hashSessionToken } from "./session-token";

export type IssueSessionInput = {
  actorKind: SessionActorKind;
  actorId: string | Types.ObjectId;
  expiresAt: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type IssuedSession = {
  id: string;
  token: string;
  expiresAt: Date;
};

/** Persist only a digest; the bearer token exists solely in this return value. */
export async function issueSession(
  connection: Connection,
  input: IssueSessionInput,
): Promise<IssuedSession> {
  if (!isValidObjectId(input.actorId)) throw new TypeError("Invalid session actor ID.");
  if (!(input.expiresAt instanceof Date) || input.expiresAt.getTime() <= Date.now()) {
    throw new RangeError("Session expiry must be in the future.");
  }
  if (input.ipAddress && !isIP(input.ipAddress)) throw new TypeError("Invalid IP address.");
  if (input.userAgent && input.userAgent.length > 512)
    throw new RangeError("User agent is too long.");

  const token = generateSessionToken();
  const record = await getSessionModel(connection).create({
    tokenHash: hashSessionToken(token),
    actorKind: input.actorKind,
    actorId: input.actorId,
    audience: input.actorKind,
    expiresAt: input.expiresAt,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
  });
  const issued: IssuedSession = {
    id: record._id.toHexString(),
    token,
    expiresAt: record.expiresAt,
  };
  Object.defineProperty(issued, "token", { value: token, enumerable: false });
  return Object.freeze(issued);
}
