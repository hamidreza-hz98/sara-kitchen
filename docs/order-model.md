# Order model (SK-0152)

`Order` is an immutable purchase-time financial and fulfillment record in the Orders module. Checkout will create it with the local Transaction and outbox records inside one MongoDB transaction in later tasks. SK-0152 supplies the model and invariants only; it does not activate checkout or payment.

## Identity and lifecycle

- The server generates `SK-XXXX-XXXX-XXXX-XXXX` from 80 cryptographically random bits, using an unambiguous Crockford-style alphabet. The unique `code` index prevents persisted collisions. A rare duplicate-key failure must cause the **outer checkout transaction** to retry with a newly generated code; do not retry a duplicate write inside an already-aborted MongoDB transaction. The checkout workflow owns that retry in SK-0154.
- The order stores a `status`, monotonically appended `statusHistory`, and a revision equal to history length. Existing events cannot be edited or removed; event keys are unique. Each event records the observed Transaction state. Allowed transitions, terminal behavior, and actor policy are defined in `docs/order-state-machine.md`.
- Transaction IDs are append-only and unique, accommodating a later replacement payment attempt or refund record without erasing history. The Orders module does not import the Transaction model.
- Customer and status timelines, transaction lookup, and unique code have indexes. Financial orders have no TTL or soft deletion.

## Historical snapshot

An order copies the customer's name/contact, delivery recipient and GeoJSON `[longitude, latitude]` address (or explicit pickup), selected locale, dish name/slug/portion, quantity and lead time, applied discount definition, unit and line EUR-cent prices, server pricing breakdown (including signed adjustments, no-VAT policy, delivery distance/base fee/free-delivery outcome), customer notes, accepted time, and earliest ready time. The maximum line lead time determines readiness. EUR 200 discounted-merchandise orders receive free delivery; pickup has no delivery fee or address. `completedAt` is a lifecycle field and may be appended later.

The model validates line/summary arithmetic, integer cents, explicit zero MVP tax, supported locales, bounded quantities and references, unique dish lines, status/revision coherence, and fulfillment/address consistency. Snapshot fields cannot be edited after insertion, even with normal document validation disabled. Mongoose query updates, replacement, deletion, and bulk writes are blocked so the Orders service must load a document and append lifecycle data via `save()` with optimistic concurrency. Direct collection/driver writes bypass Mongoose guards and must be restricted to trusted migrations.

The only language-dependent customer-facing text in an order is the **resolved label at purchase time**. It is intentionally not a mutable `translations[]` array: a later change to translations, dish price, customer profile, or saved address cannot rewrite what the customer ordered. Historical PII requires scoped admin/customer access and the retention/anonymization policy; neither the model nor generic logs should be exposed publicly.

Tests: `tests/unit/order-model.test.ts` validates shape, pricing, delivery, timing, immutability, and indexes. `tests/integration/order-model.test.ts` checks persisted code uniqueness, append-only lifecycle behavior, and historical snapshots after source records change.
