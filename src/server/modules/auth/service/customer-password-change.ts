import "server-only";

import type { Connection } from "mongoose";

import {
  changeCustomerPassword,
  getActiveCustomerIdentity,
  isStrongSignupPassword,
} from "@/server/modules/customers";
import {
  advanceOtherActorSessionPasswordVersions,
  issueSession,
  resolveSession,
  revokeActorSessions,
  revokeSession,
  type IssuedSession,
} from "@/server/modules/sessions";

export class CustomerPasswordChangeRejectedError extends Error {
  constructor(readonly reason: "session" | "current" | "same" | "stale" | "policy") {
    super("Customer password change was rejected.");
    this.name = "CustomerPasswordChangeRejectedError";
  }
}

export type CustomerPasswordChangeInput = {
  token: string;
  currentPassword: string;
  newPassword: string;
  revokeOtherSessions: boolean;
  userAgent?: string | null;
};

export async function changeCurrentCustomerPassword(
  connection: Connection,
  input: CustomerPasswordChangeInput,
): Promise<{ session: IssuedSession; persistent: boolean }> {
  if (!isStrongSignupPassword(input.newPassword))
    throw new CustomerPasswordChangeRejectedError("policy");
  const current = await resolveSession(connection, input.token, "customer");
  if (!current) throw new CustomerPasswordChangeRejectedError("session");
  const customer = await getActiveCustomerIdentity(connection, current.actorId);
  if (!customer || customer.passwordVersion !== current.passwordVersion)
    throw new CustomerPasswordChangeRejectedError("session");

  const outcome = await changeCustomerPassword(
    connection,
    current.actorId,
    current.passwordVersion,
    input.currentPassword,
    input.newPassword,
  );
  if (outcome !== "changed")
    throw new CustomerPasswordChangeRejectedError(
      outcome === "invalid-current" ? "current" : outcome === "same-password" ? "same" : "stale",
    );

  // The credential update is authoritative. Any subsequent failure leaves older-version
  // sessions unusable; it must never restore an old credential or old bearer.
  if (!(await revokeSession(connection, input.token, "customer", "password-change")))
    throw new CustomerPasswordChangeRejectedError("session");
  if (input.revokeOtherSessions) {
    await revokeActorSessions(connection, "customer", current.actorId, "password-change");
  } else {
    await advanceOtherActorSessionPasswordVersions(
      connection,
      "customer",
      current.actorId,
      current.id,
      current.passwordVersion,
      current.passwordVersion + 1,
    );
  }
  const session = await issueSession(connection, {
    actorKind: "customer",
    actorId: current.actorId,
    passwordVersion: current.passwordVersion + 1,
    persistent: current.persistent,
    expiresAt: current.expiresAt,
    userAgent: input.userAgent ?? null,
  });
  return { session, persistent: current.persistent };
}
