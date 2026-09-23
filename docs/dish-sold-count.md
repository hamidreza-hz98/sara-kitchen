# Dish sold-count derivation (SK-0097)

`Dish.soldCount` is a rebuildable catalog projection, not inventory and not the financial ledger.
The Orders workflow owns lifecycle transitions and calls the Dishes public
`createDishSoldCountProjector()` API inside the same MongoDB transaction that persists the order and
payment change. Dishes never reads the Order model.

## Qualification policy

The Orders adapter maps its detailed statuses to this deliberately small contract:

- fulfillment: `open`, `completed`, or `cancelled`;
- payment: `unpaid`, `paid`, `partially_refunded`, or `refunded`; and
- one aggregated item per Dish, with ordered quantity and item-level refunded quantity.

A unit contributes only while fulfillment is `completed` and payment is `paid` or
`partially_refunded`. Merely authorizing or collecting payment does not count food that may still be
cancelled before fulfillment. Likewise, completing an unpaid order does not count until settlement is
recorded. This applies to MB Way and cash alike; the payment adapter determines when funds are settled.

For a qualifying partially refunded order, contribution is `ordered quantity - refunded quantity`.
A monetary goodwill refund with no returned/cancelled dish units leaves `refundedQuantity` at zero and
does not rewrite unit sales. A full refund contributes zero. Cancellation contributes zero regardless
of payment state. Reopening and completing a previously cancelled/refunded order is allowed only
through a newer valid order revision and restores the exact current contribution.

## Idempotency and ordering

Each order has one private `dish_sold_projections` record containing its latest source revision,
SHA-256 snapshot fingerprint, lifecycle categories, and current per-dish contributions. The fingerprint
contains no customer or payment data.

- same revision and same fingerprint: duplicate retry, no counter write;
- same revision and different fingerprint: conflict, transaction fails;
- older revision: stale delivery, ignored;
- newer revision: only the delta between old and desired contributions is applied.

This handles provider/webhook retries and every forward or compensating status change without adding
the full quantity twice. Inputs reject duplicate dish lines, non-integer quantities, over-refunds, and
invalid revisions before persistence.

## Transaction and integration contract

Projection records and all affected Dish counters update in the transaction owned by Orders. The
repository rejects calls without an active `ClientSession`; there is no standalone/non-transactional
fallback. A missing Dish, revision conflict, or counter underflow/overflow aborts the complete order
transition, leaving every counter and the prior projection unchanged. This follows ADR-0008 and means
local checkout testing requires the replica-set environment described there.

After commit, Orders may invalidate the existing Dish/catalog cache tags for dish IDs whose returned
delta is nonzero and emit its lifecycle audit event/outbox work. Cache invalidation, audit delivery,
notifications, and provider calls must not occur inside the retryable transaction callback.

The projection can be reconciled by replaying current order snapshots in increasing revision order.
Financial reporting continues to use immutable order/payment snapshots rather than this counter.
