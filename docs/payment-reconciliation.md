# Payment reconciliation

Payment webhooks remain the primary update path. Reconciliation is a bounded recovery worker for
provider-addressable payments that have remained `created`, `pending`, or `authorized` for at least
five minutes. It never initiates a payment and never writes transaction or order status directly.

## Schedule and security

Configure the deployment scheduler to `POST /api/internal/payments/reconcile` every five minutes
with `Authorization: Bearer <PAYMENT_RECONCILIATION_CRON_SECRET>`. The secret is server-only,
stored in the deployment secret store, and should be rotated like webhook credentials. The route
is unavailable when the provider is disabled. The local MB Way simulator is deliberately blocked
in production until a real acquirer transport is approved.

## Recovery flow

1. A bounded query discovers stale nonterminal transactions that have a provider payment ID.
2. A durable queue record is upserted once per transaction and claimed with a 60-second lease.
3. The worker asks the matching provider for current status outside a MongoDB transaction.
4. The verified provider result enters the normal append-only transaction state machine. The
   transaction event, order status/history, notifications, sold-count effects, and audit record are
   committed together. An already-matching transaction still heals an inconsistent order.
5. Transient failures retry with exponential backoff. Reference, amount, currency, or transition
   conflicts alert immediately; other failures alert after four attempts. Alerts are durable in
   `payment_reconciliations` and emit a redacted structured error log for monitoring.

Only safe codes, attempt counts, provider ID, and transaction ID are retained in recovery records.
Provider payloads, credentials, payer phone numbers, and payment secrets are never stored there.
Operators resolve an alert through the existing transaction reconciliation controls after checking
the provider dashboard. A production alert rule should trigger on
`payment.reconciliation.alert` or `payment_reconciliations.state = alerted`.
