import type { AuditContext, AuditOutcome, AuditSeverity, AuditType } from "../types/audit-event";
import type { AuditLogReadRow } from "../repository/audit-log-read-repository";

export type AuditLogListItem = Readonly<{
  actionCode: string;
  actor: Readonly<{
    kind: AuditLogReadRow["actor"]["kind"];
    ref: string | null;
    snapshot: AuditLogReadRow["actor"]["snapshot"];
  }>;
  context: AuditContext;
  createdAt: string;
  id: string;
  message: string;
  networkPolicy: AuditLogReadRow["network"]["policy"];
  occurredAt: string;
  outcome: AuditOutcome;
  requestId: string;
  resource: AuditLogReadRow["resource"];
  severity: AuditSeverity;
  type: AuditType;
  userAgent: string | null;
}>;

export function mapAuditLogListItem(row: AuditLogReadRow): AuditLogListItem {
  return Object.freeze({
    actionCode: row.actionCode,
    actor: Object.freeze({
      kind: row.actor.kind,
      ref: row.actor.ref?.toHexString() ?? null,
      snapshot: Object.freeze({ ...row.actor.snapshot }),
    }),
    context: Object.freeze({ ...row.context }),
    createdAt: row.createdAt.toISOString(),
    id: row._id.toHexString(),
    message: row.message,
    networkPolicy: row.network.policy,
    occurredAt: row.occurredAt.toISOString(),
    outcome: row.outcome,
    requestId: row.requestId,
    resource: Object.freeze({
      kind: row.resource.kind,
      ref: row.resource.ref,
      snapshot: Object.freeze({ ...row.resource.snapshot }),
    }),
    severity: row.severity,
    type: row.type,
    userAgent: row.userAgent,
  });
}
