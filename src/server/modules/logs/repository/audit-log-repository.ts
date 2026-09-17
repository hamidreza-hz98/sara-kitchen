import "server-only";

import type { ClientSession, Connection } from "mongoose";

import { getAuditLogModel } from "../model/audit-log";
import type { AuditEventInput } from "../types/audit-event";

export type InsertAuditLogOptions = Readonly<{
  session?: ClientSession;
}>;

export type InsertedAuditLog = Readonly<{
  id: string;
  occurredAt: Date;
}>;

/** Private persistence adapter; callers outside Logs use recordAuditEvent(). */
export async function insertAuditLog(
  connection: Connection,
  input: AuditEventInput,
  options: InsertAuditLogOptions = {},
): Promise<InsertedAuditLog> {
  const document = new (getAuditLogModel(connection))(input);
  await document.save(options.session ? { session: options.session } : undefined);
  return Object.freeze({
    id: document._id.toHexString(),
    occurredAt: new Date(document.occurredAt),
  });
}
