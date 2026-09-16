# ADR-0008 — Keep checkout and payment state atomic in MongoDB

- Status: Accepted
- Date: 2026-09-16
- Owners: Sara Kitchen engineering

## Context

Checkout will create an order, a payment intent, immutable price/address/item snapshots, and a durable notification/provider work item. MB Way callbacks may change both payment and order state. A partially written order or payment record would be financially confusing and difficult to reconcile. MongoDB single-document writes are atomic, but these workflows span collections owned by separate modules. The current Docker Compose MongoDB is standalone; production Atlas is planned as a replica set deployment.

MongoDB [does not support multi-document transactions on standalone deployments](https://www.mongodb.com/docs/manual/core/transactions-production-consideration/). Its transaction callback may retry on transient errors, so the callback must not call external providers or send notifications ([MongoDB driver transaction behavior](https://www.mongodb.com/docs/manual/core/transactions-in-applications/)).

## Decision

The Orders workflow owns checkout and passes one explicit `ClientSession` through participating public module APIs to their repositories. `withMongoTransaction()` checks transaction-capable topology before invoking the callback and uses primary reads, snapshot read concern, and majority commit write concern. Repositories never open nested transactions or silently omit the session.

Required atomic groups:

1. **Checkout:** create the order with immutable snapshots, create the local payment intent/transaction record, transition or consume the cart as applicable, and persist outbox work for payment initiation and employer notification. Unique order/code and idempotency constraints are established before launch; SK-0044 defines the idempotency records.
2. **Payment webhook/result:** persist the verified provider event, update the payment state, transition the corresponding order state/history, and persist any invoice/notification outbox record in one transaction. Duplicate callbacks must be safe; an unknown provider outcome is reconciled, not guessed.
3. **Cancellation/refund recording:** atomically update local order/payment state, refund history, and outbox/reconciliation state after the human/provider action is known. A phone-call refund itself is never part of a database transaction.
4. **Other cross-collection invariants:** use a transaction only when both records must become visible together. Simple single-document CRUD and derived read models do not need one.

External MB Way calls, WhatsApp messages, PDF generation, MinIO uploads, and cache revalidation happen **after commit**, from durable, retryable outbox work. Their failures never roll back a committed order. Provider events are verified and recorded before acknowledgement. Recovery/reconciliation compares durable local state with provider state and replays missing outbox work. No provider call or network side effect may run in a transaction callback, since the callback may be retried.

Production and staging must use transaction-capable MongoDB replica sets (or sharded clusters) with a tested failover configuration. Current local Compose MongoDB is standalone: ordinary CRUD remains available, but checkout/payment workflows fail closed before writing. Replica-set integration tests run via `MongoMemoryReplSet`; local end-to-end checkout development will require a separately configured local replica set before that feature is enabled. Never add a non-transactional fallback that performs only some writes.

## Alternatives considered

### Independent writes with compensation

Rejected for order and payment records because process crashes and provider timeouts can leave partial financial state, while compensation itself can fail.

### Put every operation in a transaction

Rejected because single-document CRUD already has atomicity, transactions add latency/lock pressure, and network side effects cannot be made atomic with MongoDB.

### Send payment and WhatsApp messages inside the transaction

Rejected because external effects cannot roll back and transaction callbacks may retry. The outbox plus idempotent dispatcher is the durable boundary.

### Let standalone development silently bypass transactions

Rejected because it would make local success misleading and hide correctness bugs until production.

## Consequences

### Positive

- Order, local payment, and outbox state commit or roll back together.
- A failed provider/message request can be retried without inventing an order state.
- Failure-injection tests exercise the same transaction boundary against a real replica-set topology.

### Costs and risks

- Checkout cannot run against the current standalone local Compose MongoDB.
- All participating writes must carry the same session; omitting it can escape rollback.
- Atlas availability, majority-write latency, indexes, short callbacks, retry safety, and outbox processing require monitoring.
- MongoDB cannot make external provider effects atomic; idempotency and reconciliation remain necessary.

## Revisit when

- An order or payment workflow needs a longer-running external step inside the proposed atomic scope.
- Transaction latency, contention, or replica-set topology changes threaten checkout targets.
- A durable message broker replaces the database outbox with equivalent guarantees.
