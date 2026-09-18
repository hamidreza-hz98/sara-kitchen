import "server-only";

import type { Connection } from "mongoose";

import { recordAuditEvent } from "@/server/modules/logs";

import type { CategoryAuditEvent } from "./category-crud";

const ACTION_CODES = {
  create: "crud.resource.create",
  read: "security.access.check",
  update: "crud.resource.update",
  archive: "crud.resource.update",
  restore: "crud.resource.update",
  delete: "crud.resource.delete",
} as const;

/** Route/job adapter for the canonical append-only English audit service. */
export function createCategoryAuditSink(
  connection: Connection,
  context: Readonly<{ requestId: string; userAgent?: string | null }>,
) {
  return async (event: CategoryAuditEvent): Promise<void> => {
    await recordAuditEvent(connection, {
      action: ACTION_CODES[event.action],
      actor: {
        kind: "admin",
        ref: event.actorId,
        snapshot: { displayName: null, role: null },
      },
      resource: {
        kind: "category",
        ref: event.categoryId,
        snapshot: { code: null, label: null, status: null },
      },
      outcome: event.outcome,
      requestId: context.requestId,
      context: { categoryAction: event.action },
      network: { policy: "omitted", ipHash: null, ipAddress: null },
      userAgent: context.userAgent ?? null,
    });
  };
}
