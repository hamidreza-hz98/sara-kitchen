import "server-only";

import type { Connection } from "mongoose";

import { recordAuditEvent } from "@/server/modules/logs";

import type { AddressCrudAuditEvent } from "./address-crud";

const ACTION_CODES = {
  list: "security.access.check",
  read: "security.access.check",
  create: "crud.resource.create",
  update: "crud.resource.update",
  delete: "crud.resource.delete",
  "set-default": "crud.resource.update",
} as const;

export function createAddressAuditSink(
  connection: Connection,
  context: Readonly<{ requestId: string; userAgent?: string | null }>,
) {
  return async (event: AddressCrudAuditEvent): Promise<void> => {
    await recordAuditEvent(connection, {
      action: ACTION_CODES[event.action],
      actor: {
        kind: event.actor.kind,
        ref: event.actor.id,
        snapshot: { displayName: null, role: null },
      },
      resource: {
        kind: "address",
        ref: event.addressId,
        snapshot: { code: null, label: null, status: null },
      },
      outcome: event.outcome,
      requestId: context.requestId,
      context: { addressAction: event.action, customerId: event.customerId },
      network: { policy: "omitted", ipHash: null, ipAddress: null },
      userAgent: context.userAgent ?? null,
    });
  };
}
