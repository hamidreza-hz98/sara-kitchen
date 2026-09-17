# Observability

This server-only package owns the typed operational logging contract. It normalizes one event before
rendering it as readable local text or production JSON, recursively redacts unsafe values, and adds
deployment/request correlation. It must not be used as a substitute for the append-only business
audit trail in `server/modules/logs`.

See [`docs/structured-logging.md`](../../../docs/structured-logging.md) for the field, privacy, and
operations contract.
