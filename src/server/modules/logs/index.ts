/** Public entry point for append-only audit activity. */
export const MODULE_NAME = "logs" as const;

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
  type AuditEventInput,
  type AuditNetworkPolicy,
  type AuditOutcome,
  type AuditResourceSnapshot,
  type AuditSeverity,
  type AuditType,
} from "./types/audit-event";
