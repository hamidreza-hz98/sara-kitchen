import "server-only";

import type { Connection } from "mongoose";

import {
  findCustomerForLogin,
  getActiveCustomerIdentity,
  verifyCustomerPasswordForLogin,
  type ActiveCustomerIdentity,
} from "@/server/modules/customers";
import {
  issueSession,
  resolveSession,
  revokeSession,
  type IssuedSession,
} from "@/server/modules/sessions";
import { hashPassword, verifyPassword } from "@/server/security/password";

const STANDARD_LIFETIME_MS = 12 * 60 * 60 * 1_000;
const PERSISTENT_LIFETIME_MS = 30 * 24 * 60 * 60 * 1_000;
let dummyHashPromise: Promise<string> | undefined;

export class CustomerLoginRejectedError extends Error {
  constructor() {
    super("Invalid customer credentials.");
    this.name = "CustomerLoginRejectedError";
  }
}

export type CustomerLoginInput = {
  identifier: string;
  password: string;
  persistent: boolean;
  priorToken?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type CustomerLoginResult = {
  customer: ActiveCustomerIdentity;
  session: IssuedSession;
  persistent: boolean;
};

async function consumeDummyVerification(password: string): Promise<void> {
  dummyHashPromise ??= hashPassword("Sara Kitchen customer dummy credential for timing");
  await verifyPassword(password, await dummyHashPromise);
}

export async function loginCustomer(
  connection: Connection,
  input: CustomerLoginInput,
): Promise<CustomerLoginResult> {
  const candidate = await findCustomerForLogin(connection, input.identifier);
  if (!candidate) {
    await consumeDummyVerification(input.password);
    throw new CustomerLoginRejectedError();
  }
  if (!(await verifyCustomerPasswordForLogin(connection, candidate.id, input.password))) {
    throw new CustomerLoginRejectedError();
  }
  const customer = await getActiveCustomerIdentity(connection, candidate.id);
  if (!customer || customer.passwordVersion !== candidate.passwordVersion) {
    throw new CustomerLoginRejectedError();
  }
  if (input.priorToken)
    await revokeSession(connection, input.priorToken, "customer", "login-rotation");
  const now = new Date();
  const session = await issueSession(connection, {
    actorKind: "customer",
    actorId: customer.id,
    passwordVersion: customer.passwordVersion,
    persistent: input.persistent,
    expiresAt: new Date(
      now.getTime() + (input.persistent ? PERSISTENT_LIFETIME_MS : STANDARD_LIFETIME_MS),
    ),
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
  });
  return { customer, session, persistent: input.persistent };
}

export async function resolveCustomerActor(
  connection: Connection,
  token: string | undefined,
): Promise<ActiveCustomerIdentity | null> {
  if (!token) return null;
  const session = await resolveSession(connection, token, "customer");
  if (!session) return null;
  const customer = await getActiveCustomerIdentity(connection, session.actorId);
  return customer && customer.passwordVersion === session.passwordVersion ? customer : null;
}

export async function logoutCustomer(
  connection: Connection,
  token: string | undefined,
): Promise<void> {
  if (token) await revokeSession(connection, token, "customer", "logout");
}
