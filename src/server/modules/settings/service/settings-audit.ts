import "server-only";

import type { Connection } from "mongoose";

import { recordAuditEvent } from "@/server/modules/logs";

import type { SettingsAuditEvent } from "./settings-service";

/** Writes bounded path-only diffs; no setting values or translated copy enter the audit context. */
export function createSettingsAuditSink(
  connection: Connection,
  context: Readonly<{ requestId: string; userAgent?: string | null }>,
) {
  return async (event: SettingsAuditEvent): Promise<void> => {
    await recordAuditEvent(connection, {
      action: event.action === "read" ? "security.access.check" : "settings.section.update",
      actor: {
        kind: "admin",
        ref: event.actorId,
        snapshot: { displayName: null, role: null },
      },
      resource: {
        kind: "settings-section",
        ref: event.key,
        snapshot: { code: event.key, label: event.key, status: event.publication },
      },
      outcome: event.outcome,
      requestId: context.requestId,
      context: {
        settingsAction: event.action,
        sectionKey: event.key,
        publication: event.publication,
        changedPathCount: event.summary?.changedPathCount ?? null,
        changedPaths:
          event.summary && event.summary.changedPaths.length > 0
            ? event.summary.changedPaths.join("|")
            : null,
        diffTruncated: event.summary?.truncated ?? null,
        fromRevision: event.summary?.fromRevision ?? null,
        toRevision: event.summary?.toRevision ?? null,
      },
      network: { policy: "omitted", ipHash: null, ipAddress: null },
      userAgent: context.userAgent ?? null,
    });
  };
}
