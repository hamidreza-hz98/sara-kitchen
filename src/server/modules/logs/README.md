# Logs

Owns append-only English audit events, actor/resource snapshots, outcomes, severity/type, request correlation, redaction, retention, and authorized reads. Actor and resource identifiers are polymorphic opaque values; Logs must not import any domain model.

All modules append through the public `recordAuditEvent()` command and select an action from the
canonical English catalog. The service derives message, type, and severity; validates context before
persistence; supports an explicit caller-owned MongoDB session; returns a serializable frozen receipt;
and never exposes its model or repository.

The schema, creation service, and privacy contract are documented in
[`docs/audit-logging.md`](../../../../docs/audit-logging.md). The private Mongoose model is not a
cross-module API. Other modules must not import it or write audit records directly.
