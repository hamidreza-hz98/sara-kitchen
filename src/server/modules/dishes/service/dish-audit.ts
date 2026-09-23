import "server-only";

import type { Connection } from "mongoose";

import { recordAuditEvent } from "@/server/modules/logs";

import type { DishAuditEvent } from "./dish-crud";

const ACTION_CODES = {
  create: "crud.resource.create",
  read: "security.access.check",
  update: "crud.resource.update",
  archive: "crud.resource.update",
  restore: "crud.resource.update",
} as const;

/** Request-scoped adapter for the canonical append-only English audit service. */
export function createDishAuditSink(
  connection: Connection,
  context: Readonly<{ requestId: string; userAgent?: string | null }>,
) {
  return async (event: DishAuditEvent): Promise<void> => {
    await recordAuditEvent(connection, {
      action: ACTION_CODES[event.action],
      actor: {
        kind: "admin",
        ref: event.actorId,
        snapshot: { displayName: null, role: null },
      },
      resource: {
        kind: "dish",
        ref: event.dishId,
        snapshot: { code: null, label: null, status: null },
      },
      outcome: event.outcome,
      requestId: context.requestId,
      context: { dishAction: event.action },
      network: { policy: "omitted", ipHash: null, ipAddress: null },
      userAgent: context.userAgent ?? null,
    });
  };
}
