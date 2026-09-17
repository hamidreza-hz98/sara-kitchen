"use server";

import { cookies } from "next/headers";

import { connectToDatabase } from "@/server/database";
import {
  adminCookieName,
  customerCookieName,
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
  if (principal === "admin") await requireAdminActor(connection, token, "dashboard:view");
  else await requireCustomerActor(connection, token);
  return revokeAllOtherActorSessions(connection, principal, token);
}
