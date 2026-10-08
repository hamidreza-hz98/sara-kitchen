import "server-only";

import type { Connection } from "mongoose";

import { recordAuditEvent } from "@/server/modules/logs";

import type { ContactAuditEvent } from "./contact-flow";

const ACTION_CODES = {
  create: "crud.resource.create",
  list: "security.access.check",
  read: "security.access.check",
  update: "crud.resource.update",
  archive: "crud.resource.update",
  delete: "crud.resource.delete",
} as const;

export function createContactAuditSink(
  connection: Connection,
  context: Readonly<{ requestId: string; userAgent?: string | null }>,
) {
  return async (event: ContactAuditEvent): Promise<void> => {
    await recordAuditEvent(connection, {
      action: ACTION_CODES[event.action],
      actor: {
        kind: event.actor.kind,
        ref: event.actor.id,
        snapshot: { displayName: null, role: null },
      },
      resource: {
        kind: "contact_submission",
        ref: event.contactId,
        snapshot: { code: null, label: null, status: null },
      },
      outcome: event.outcome,
      requestId: context.requestId,
      context: { contactAction: event.action },
      network: { policy: "omitted", ipHash: null, ipAddress: null },
      userAgent: context.userAgent ?? null,
    });
  };
}
