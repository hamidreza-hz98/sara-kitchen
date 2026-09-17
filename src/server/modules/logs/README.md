# Logs

Owns append-only English audit events, actor/resource snapshots, outcomes, severity/type, request correlation, redaction, retention, and authorized reads. Actor and resource identifiers are polymorphic opaque values; Logs must not import any domain model.

The SK-0063 schema and privacy contract are documented in
[`docs/audit-logging.md`](../../../../docs/audit-logging.md). The private Mongoose model is not a
cross-module API. Until the create service arrives, other modules must not import it or write audit
records directly.
