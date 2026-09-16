# Transactions

Owns provider/type, monetary state, provider references, idempotency, append-only payment events, webhook processing, reconciliation, and manual refund recording. It may consume Customers’ public API. Order identifiers are opaque references so payment callbacks do not import the Order model.

Payment callbacks persist their verified event and local state within the Orders-owned workflow transaction, using an explicit session. External MB Way requests and phone-call refunds are never made inside that transaction. Unknown results enter reconciliation; see `docs/adr/0008-transaction-boundaries.md`.
