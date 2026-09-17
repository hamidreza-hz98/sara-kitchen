import "server-only";

import type { Connection } from "mongoose";

import { getActiveAdminIdentity } from "@/server/modules/admins";
import { getActiveCustomerIdentity } from "@/server/modules/customers";
import {
  listActiveActorSessions,
  resolveSession,
  revokeOtherActorSessions,
  revokeOwnedActorSession,
  type ActiveSessionPage,
} from "@/server/modules/sessions";

export type SessionPrincipal = "admin" | "customer";

export class ActorSessionRejectedError extends Error {
  constructor(readonly reason: "unauthenticated" | "not-found") {
    super("Session management request was rejected.");
    this.name = "ActorSessionRejectedError";
  }
}

async function requireActorSession(
  connection: Connection,
  principal: SessionPrincipal,
  token: string | undefined,
) {
  if (!token) throw new ActorSessionRejectedError("unauthenticated");
  const session = await resolveSession(connection, token, principal);
  if (!session) throw new ActorSessionRejectedError("unauthenticated");
  const actor =
    principal === "admin"
      ? await getActiveAdminIdentity(connection, session.actorId)
      : await getActiveCustomerIdentity(connection, session.actorId);
  if (!actor || actor.passwordVersion !== session.passwordVersion)
    throw new ActorSessionRejectedError("unauthenticated");
  return session;
}

export async function getActorActiveSessions(
  connection: Connection,
  principal: SessionPrincipal,
  token: string | undefined,
  page = 1,
): Promise<ActiveSessionPage> {
  const current = await requireActorSession(connection, principal, token);
  return listActiveActorSessions(
    connection,
    principal,
    current.actorId,
    current.passwordVersion,
    current.id,
    page,
  );
}

export async function revokeActorSessionById(
  connection: Connection,
  principal: SessionPrincipal,
  token: string | undefined,
  sessionId: string,
): Promise<void> {
  const current = await requireActorSession(connection, principal, token);
  if (
    !(await revokeOwnedActorSession(connection, principal, current.actorId, sessionId, current.id))
  )
    throw new ActorSessionRejectedError("not-found");
}

export async function revokeAllOtherActorSessions(
  connection: Connection,
  principal: SessionPrincipal,
  token: string | undefined,
): Promise<number> {
  const current = await requireActorSession(connection, principal, token);
  return revokeOtherActorSessions(connection, principal, current.actorId, current.id);
}
