import "server-only";

import type { Connection } from "mongoose";

import { recordAuditEvent } from "@/server/modules/logs";

import type { StaticSeoAuditEvent } from "./static-seo";

export function createStaticSeoAuditSink(
  connection: Connection,
  context: Readonly<{ requestId: string; userAgent?: string | null }>,
) {
  return async (event: StaticSeoAuditEvent): Promise<void> => {
    await recordAuditEvent(connection, {
      action: event.action === "read" ? "security.access.check" : `crud.resource.${event.action}`,
      actor: {
        kind: "admin",
        ref: event.actorId,
        snapshot: { displayName: null, role: null },
      },
      resource: {
        kind: "seo_page",
        ref: null,
        snapshot: { code: event.key, label: event.key, status: null },
      },
      outcome: event.outcome,
      requestId: context.requestId,
      context: { seoAction: event.action, staticPageKey: event.key },
      network: { policy: "omitted", ipHash: null, ipAddress: null },
      userAgent: context.userAgent ?? null,
    });
  };
}
