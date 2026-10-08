import "server-only";

import type { Connection } from "mongoose";

import { recordAuditEvent } from "@/server/modules/logs";

import type { AdminCrudAuditEvent } from "./admin-crud";

const ACTION_CODES = {
  create: "crud.resource.create",
  read: "security.access.check",
  update: "crud.resource.update",
  disable: "crud.resource.update",
  reactivate: "crud.resource.update",
  "reset-credential": "crud.resource.update",
  delete: "crud.resource.delete",
} as const;

export function createAdminAuditSink(
  connection: Connection,
  context: Readonly<{ requestId: string; userAgent?: string | null }>,
) {
  return async (event: AdminCrudAuditEvent): Promise<void> => {
    await recordAuditEvent(connection, {
      action: ACTION_CODES[event.action],
      actor: {
        kind: "admin",
        ref: event.actorId,
        snapshot: { displayName: null, role: null },
      },
      resource: {
        kind: "admin",
        ref: event.adminId,
        snapshot: { code: null, label: null, status: null },
      },
      outcome: event.outcome,
      requestId: context.requestId,
      context: { adminAction: event.action },
      network: { policy: "omitted", ipHash: null, ipAddress: null },
      userAgent: context.userAgent ?? null,
    });
  };
}
