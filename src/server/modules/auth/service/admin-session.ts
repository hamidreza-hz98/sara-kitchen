import "server-only";

import type { Connection } from "mongoose";

import {
  findAdminForLogin,
  getActiveAdminIdentity,
  recordAdminLastLogin,
  verifyAdminPasswordForLogin,
  type ActiveAdminIdentity,
} from "@/server/modules/admins";
import {
  issueSession,
  resolveSession,
  revokeSession,
  type IssuedSession,
} from "@/server/modules/sessions";
import { hashPassword, verifyPassword } from "@/server/security/password";

const ADMIN_SESSION_LIFETIME_MS = 12 * 60 * 60 * 1_000;
let dummyHashPromise: Promise<string> | undefined;

export class AdminLoginRejectedError extends Error {
  constructor() {
    super("Invalid administrator credentials.");
    this.name = "AdminLoginRejectedError";
  }
}

export type AdminLoginInput = {
  identifier: string;
  password: string;
  priorToken?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type AdminLoginResult = {
  session: IssuedSession;
  admin: ActiveAdminIdentity;
};

async function consumeDummyVerification(password: string): Promise<void> {
  dummyHashPromise ??= hashPassword("Sara Kitchen dummy credential never used for login");
  await verifyPassword(password, await dummyHashPromise);
}

export async function loginAdmin(
  connection: Connection,
  input: AdminLoginInput,
): Promise<AdminLoginResult> {
  const candidate = await findAdminForLogin(connection, input.identifier);
  if (!candidate) {
    await consumeDummyVerification(input.password);
    throw new AdminLoginRejectedError();
  }
  if (!(await verifyAdminPasswordForLogin(connection, candidate.id, input.password))) {
    throw new AdminLoginRejectedError();
  }
  const admin = await getActiveAdminIdentity(connection, candidate.id);
  if (!admin || admin.passwordVersion !== candidate.passwordVersion) {
    throw new AdminLoginRejectedError();
  }

  // Drop any pre-existing admin bearer before granting a newly generated one.
  if (input.priorToken)
    await revokeSession(connection, input.priorToken, "admin", "login-rotation");
  const now = new Date();
  const session = await issueSession(connection, {
    actorKind: "admin",
    actorId: admin.id,
    passwordVersion: admin.passwordVersion,
    expiresAt: new Date(now.getTime() + ADMIN_SESSION_LIFETIME_MS),
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
  });
  if (!(await recordAdminLastLogin(connection, admin.id, now))) {
    await revokeSession(connection, session.token, "admin", "security");
    throw new AdminLoginRejectedError();
  }
  return { session, admin };
}

export async function resolveAdminActor(
  connection: Connection,
  token: string | undefined,
): Promise<ActiveAdminIdentity | null> {
  if (!token) return null;
  const session = await resolveSession(connection, token, "admin");
  if (!session) return null;
  const admin = await getActiveAdminIdentity(connection, session.actorId);
  return admin && admin.passwordVersion === session.passwordVersion ? admin : null;
}

export async function logoutAdmin(
  connection: Connection,
  token: string | undefined,
): Promise<void> {
  if (token) await revokeSession(connection, token, "admin", "logout");
}
