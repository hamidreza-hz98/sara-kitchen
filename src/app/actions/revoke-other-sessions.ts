"use server";

import { cookies, headers } from "next/headers";

import { connectToDatabase } from "@/server/database";
import {
  adminCookieName,
  customerCookieName,
  limitSensitiveAccountOperation,
  requireAdminActor,
  requireCustomerActor,
  revokeAllOtherActorSessions,
  AuthorizationGuardError,
} from "@/server/modules/auth";

/** A Server Action still authorizes itself; protected page layouts do not cover action calls. */
export async function revokeOtherSessionsAction(principal: "admin" | "customer") {
  if (principal !== "admin" && principal !== "customer") {
    throw new AuthorizationGuardError("forbidden");
  }
  const token = (await cookies()).get(
    principal === "admin" ? adminCookieName() : customerCookieName(),
  )?.value;
  const connection = await connectToDatabase();
  const actor =
    principal === "admin"
      ? await requireAdminActor(connection, token, "dashboard:view")
      : await requireCustomerActor(connection, token);
  await limitSensitiveAccountOperation(
    connection,
    new Request("https://internal.invalid/session-action", { headers: await headers() }),
    { principal, actorId: actor.id, operation: "sessions" },
  );
  return revokeAllOtherActorSessions(connection, principal, token);
}
