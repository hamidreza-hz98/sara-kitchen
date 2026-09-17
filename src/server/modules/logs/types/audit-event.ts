export const AUDIT_ACTOR_KINDS = ["admin", "customer", "system", "anonymous"] as const;
export const AUDIT_OUTCOMES = ["success", "failure", "denied"] as const;
export const AUDIT_SEVERITIES = ["info", "warning", "error", "critical"] as const;
export const AUDIT_TYPES = [
  "authentication",
  "authorization",
  "data",
  "business",
  "security",
  "system",
] as const;
export const AUDIT_NETWORK_POLICIES = ["hashed", "retained", "omitted"] as const;

export type AuditActorKind = (typeof AUDIT_ACTOR_KINDS)[number];
export type AuditOutcome = (typeof AUDIT_OUTCOMES)[number];
export type AuditSeverity = (typeof AUDIT_SEVERITIES)[number];
export type AuditType = (typeof AUDIT_TYPES)[number];
export type AuditNetworkPolicy = (typeof AUDIT_NETWORK_POLICIES)[number];
export type AuditContextValue = boolean | number | string | null;
export type AuditContext = Readonly<Record<string, AuditContextValue>>;

export type AuditActorSnapshot = {
  displayName: string | null;
  role: string | null;
};

export type AuditResourceSnapshot = {
  code: string | null;
  label: string | null;
  status: string | null;
};

export type AuditEventInput = {
  actionCode: string;
  message: string;
  actor: {
    kind: AuditActorKind;
    ref: string | null;
    snapshot: AuditActorSnapshot;
  };
  resource: {
    kind: string;
    ref: string | null;
    snapshot: AuditResourceSnapshot;
  };
  outcome: AuditOutcome;
  severity: AuditSeverity;
  type: AuditType;
  requestId: string;
  context?: AuditContext;
  network: {
    policy: AuditNetworkPolicy;
    ipHash: string | null;
    ipAddress: string | null;
  };
  userAgent: string | null;
  occurredAt?: Date;
};
