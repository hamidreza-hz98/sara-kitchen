import "server-only";

/** Public entry point for append-only audit activity. */
export const MODULE_NAME = "logs" as const;

export {
  AUDIT_ACTION_DEFINITIONS,
  getAuditActionDefinition,
  isAuditActionCode,
  type AuditActionCode,
  type AuditActionDefinition,
} from "./types/audit-actions";

export {
  AUDIT_ACTOR_KINDS,
  AUDIT_NETWORK_POLICIES,
  AUDIT_OUTCOMES,
  AUDIT_SEVERITIES,
  AUDIT_TYPES,
  type AuditActorKind,
  type AuditActorSnapshot,
  type AuditContext,
  type AuditContextValue,
  type AuditNetworkPolicy,
  type AuditOutcome,
  type AuditResourceSnapshot,
  type AuditSeverity,
  type AuditType,
} from "./types/audit-event";
export {
  recordAuditEvent,
  type RecordedAuditEvent,
  type RecordAuditEventInput,
  type RecordAuditEventOptions,
} from "./service/record-audit-event";
