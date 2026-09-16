# Orders

Owns order codes, immutable customer/address/item/pricing snapshots, status machine/history, fulfillment timing, and checkout transaction boundaries. It may consume public APIs from Carts, Customers, Addresses, Dishes, and Transactions. It never imports those modules’ models or repositories.

Checkout opens the shared transaction boundary and passes its session explicitly to participating public module APIs. Order, local payment intent, cart transition, and outbox records commit together. Provider calls and WhatsApp notifications occur only after commit; see `docs/adr/0008-transaction-boundaries.md`.
