# Orders

Owns order codes, immutable customer/address/item/pricing snapshots, status machine/history, fulfillment timing, and checkout transaction boundaries. It may consume public APIs from Carts, Customers, Addresses, Dishes, and Transactions. It never imports those modules’ models or repositories.

Checkout owns workflow composition and passes one transaction session explicitly to participating public module APIs. Order, local payment intent, cart transition, and outbox records commit together. Provider calls and WhatsApp notifications occur only after commit; see `docs/adr/0008-transaction-boundaries.md`.

For checkout implementation, use Transactions' public `runIdempotentOperation()` as the outer transaction owner; do not open a nested transaction. Its callback creates the order, local payment intent, cart transition, and outbox records with the supplied session. See `docs/idempotency.md`.
