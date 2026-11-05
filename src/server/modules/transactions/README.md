# Transactions

Owns provider/type, monetary state, provider references, idempotency, append-only payment events, webhook processing, and provider-backed reconciliation/cancellation/refunds. It may consume Customers’ public API. Order identifiers are opaque references so payment callbacks do not import the Order model; the route injects an Orders public-API hook into the same database transaction.

The private `Transaction` Mongoose model and its invariants are documented in `docs/transaction-model.md`. Other modules must use future public transaction services, never import the model directly.

The state transition table and replay rules are documented in `docs/transaction-state-machine.md`. The model rejects histories that the policy cannot replay. SIBS sandbox statuses are normalized into the same transition table.

The public provider contract and deterministic fake are documented in `docs/payment-provider-interface.md`. Checkout uses the SIBS MB WAY sandbox adapter; the fake remains a test fixture.

The SIBS MB WAY sandbox adapter, sandbox-only environment configuration, and provider-reference persistence are documented in `docs/mbway-sandbox-integration.md`. It may run in local and production deployments, but the adapter is hard-pinned to the SIBS sandbox host and cannot collect live funds.

Payment callbacks persist their verified event and local state within the Orders-owned workflow transaction, using an explicit session. External MB Way requests and phone-call refunds are never made inside that transaction. Unknown results enter reconciliation; see `docs/adr/0008-transaction-boundaries.md`.

The private `idempotency_records` collection and public `runIdempotentOperation()` contract are documented in `docs/idempotency.md`. The unique index is the concurrency guard; the TTL index is retention cleanup, not an exact expiration clock. The service owns the transaction, passes its session to the caller's workflow, and persists a small replayable result atomically. No external side effects are permitted inside its callback.

The MB WAY webhook Route Handler decrypts and authenticates SIBS AES-GCM notifications, stores a durable event inbox, and updates Transaction/Order state atomically. See `docs/payment-webhook.md` and `docs/request-security.md`.

SK-0156 adds permission-gated transaction reads, an audited internal note, verified provider-status reconciliation, and provider-confirmed cancellation/refund operations. There is no admin create/delete or arbitrary amount/status update endpoint. See `docs/transaction-management.md`.

SK-0161 adds a scheduler-authenticated, bounded payment-reconciliation worker. It discovers stale
provider-addressable payments, uses leased durable work records, retries provider reads with bounded
backoff, applies verified states through the existing transaction/order workflow, and durably alerts
on mismatches or exhaustion. See `docs/payment-reconciliation.md`.
