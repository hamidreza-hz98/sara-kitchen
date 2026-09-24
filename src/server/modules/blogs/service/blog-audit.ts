import "server-only";

import type { Connection } from "mongoose";

import { recordAuditEvent } from "@/server/modules/logs";

import type { BlogAuditEvent } from "./blog-crud";

const ACTION_CODES = {
  create: "crud.resource.create",
  read: "security.access.check",
  update: "crud.resource.update",
  preview: "security.access.check",
  schedule: "crud.resource.update",
  publish: "crud.resource.update",
  unpublish: "crud.resource.update",
  archive: "crud.resource.update",
} as const;

export function createBlogAuditSink(
  connection: Connection,
  context: Readonly<{ requestId: string; userAgent?: string | null }>,
) {
  return async (event: BlogAuditEvent): Promise<void> => {
    await recordAuditEvent(connection, {
      action: ACTION_CODES[event.action],
      actor: {
        kind: event.actorKind,
        ref: event.actorId,
        snapshot: { displayName: null, role: null },
      },
      resource: {
        kind: "blog",
        ref: event.blogId,
        snapshot: { code: null, label: null, status: null },
      },
      outcome: event.outcome,
      requestId: context.requestId,
      context: { blogAction: event.action },
      network: { policy: "omitted", ipHash: null, ipAddress: null },
      userAgent: context.userAgent ?? null,
    });
  };
}
