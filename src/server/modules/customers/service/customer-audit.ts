import "server-only";

import type { Connection } from "mongoose";

import { recordAuditEvent } from "@/server/modules/logs";

import type { CustomerCrudAuditEvent } from "./customer-crud";

const ACTION_CODES = {
  list: "security.access.check",
  read: "security.access.check",
  update: "crud.resource.update",
  status: "crud.resource.update",
  export: "privacy.customer.export",
  anonymize: "privacy.customer.anonymize",
} as const;

export function createCustomerAuditSink(
  connection: Connection,
  context: Readonly<{ requestId: string; userAgent?: string | null }>,
) {
  return async (event: CustomerCrudAuditEvent): Promise<void> => {
    await recordAuditEvent(connection, {
      action: ACTION_CODES[event.action],
      actor: {
        kind: event.actor.kind,
        ref: event.actor.id,
        snapshot: { displayName: null, role: null },
      },
      resource: {
        kind: "customer",
        ref: event.customerId,
        snapshot: { code: null, label: null, status: null },
      },
      outcome: event.outcome,
      requestId: context.requestId,
      context: { customerAction: event.action },
      network: { policy: "omitted", ipHash: null, ipAddress: null },
      userAgent: context.userAgent ?? null,
    });
  };
}
