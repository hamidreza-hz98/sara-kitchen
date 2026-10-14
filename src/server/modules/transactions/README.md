# Transactions

Owns provider/type, monetary state, provider references, idempotency, append-only payment events, webhook processing, reconciliation, and manual refund recording. It may consume Customers’ public API. Order identifiers are opaque references so payment callbacks do not import the Order model.

The private `Transaction` Mongoose model and its invariants are documented in `docs/transaction-model.md`. Other modules must use future public transaction services, never import the model directly.

The state transition table, replay rules, and internal MB Way sandbox fixture mapping are documented in `docs/transaction-state-machine.md`. The model rejects histories that the policy cannot replay. The selected live acquirer still needs its own authenticated event adapter.

The public provider contract and deterministic fake are documented in `docs/payment-provider-interface.md`. The fake is for tests only and is not wired into checkout or presented as a live MB Way gateway.

The local MB Way sandbox adapter, timeout/idempotency policy, and provider-reference persistence are documented in `docs/mbway-sandbox-integration.md`. It is not a remote PSP connection and must not be enabled as a production payment rail.

Payment callbacks persist their verified event and local state within the Orders-owned workflow transaction, using an explicit session. External MB Way requests and phone-call refunds are never made inside that transaction. Unknown results enter reconciliation; see `docs/adr/0008-transaction-boundaries.md`.

The private `idempotency_records` collection and public `runIdempotentOperation()` contract are documented in `docs/idempotency.md`. The unique index is the concurrency guard; the TTL index is retention cleanup, not an exact expiration clock. The service owns the transaction, passes its session to the caller's workflow, and persists a small replayable result atomically. No external side effects are permitted inside its callback.

SK-0151 adds a local-simulator-only webhook Route Handler, strict raw-body verification, durable event inbox, and transactional Transaction state update. It is disabled in production and does not update an Order until that module exists. See `docs/payment-webhook.md` and `docs/request-security.md`. A selected acquirer's documented signature format may replace this isolated verifier but may not bypass provider authentication.
