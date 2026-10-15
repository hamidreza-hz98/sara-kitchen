# Orders

Owns order codes, immutable customer/address/item/pricing snapshots, status machine/history, fulfillment timing, and checkout transaction boundaries. It may consume public APIs from Carts, Customers, Addresses, Dishes, and Transactions. It never imports those modules’ models or repositories.

Checkout owns workflow composition and passes one transaction session explicitly to participating public module APIs. Order, local payment intent, cart transition, and outbox records commit together. Provider calls and WhatsApp notifications occur only after commit; see `docs/adr/0008-transaction-boundaries.md`.

SK-0157 adds the order notification outbox, localized customer in-app notices, and an idempotent retry dispatcher contract. Live employer WhatsApp delivery remains disabled until provider credentials and approved templates are available; see `docs/order-notifications.md`.

The private `Order` model, human-code uniqueness, immutable purchase snapshots, append-only lifecycle data, and indexes are specified in `docs/order-model.md`. Only this module may import its model. The transition graph, payment coupling, actor permissions, notification intents, and sold-count mapping are specified in `docs/order-state-machine.md`. Checkout must retry the entire transaction on a rare generated-code collision.

For checkout implementation, use Transactions' public `runIdempotentOperation()` as the outer transaction owner; do not open a nested transaction. Its callback creates the order, local payment intent, cart transition, and outbox records with the supplied session. See `docs/idempotency.md`.

Administrative order reads and post-checkout actions are described in `docs/order-management.md`. Customer checkout remains the sole creation path by product decision; staff cannot impersonate customer consent or replace historical snapshots.
