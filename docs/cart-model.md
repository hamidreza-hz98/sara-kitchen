# Cart persistence model

SK-0137 materializes the identity and lifecycle rules accepted in
[ADR-0009](./adr/0009-server-side-cart-identity.md). The private `carts` collection is owned by the
Carts module; other modules use its eventual public service contracts and never import the model.

## Record shape

Each cart stores:

- lifecycle `status`: `active`, `merged`, `converted`, or `expired`;
- exactly one immutable identity: `customerId` or a SHA-256 `guestTokenHash`;
- unique dish lines with integer quantities from 1 through 99, capped at 100 distinct dishes;
- optional customer `selectedAddressId` and bounded plain-text notes;
- a server-owned EUR pricing summary containing subtotal, discount, delivery fee, tax, signed
  adjustments, total, and calculation time;
- an explicit positive `version` for future optimistic mutation checks;
- an idle `expiresAt`, guest-only `absoluteExpiresAt`, and terminal-only `purgeAt`;
- a merge target only on a terminal merged guest cart;
- base schema identity, actor metadata, schema version, and timestamps.

The pricing components must satisfy:

```text
total = subtotal - discount + delivery fee + tax + adjustments
```

All amounts are safe integer cents. Discount cannot exceed subtotal, the result cannot be negative,
and non-empty carts require a calculation timestamp. The schema is a storage safety net; SK-0138 owns
authoritative price calculation and SK-0139 owns catalog/availability checks.

## Identity and lifecycle invariants

Guest-token digests use exactly 64 lowercase hexadecimal characters, are excluded from ordinary
queries, and are removed from JSON serialization. No raw guest token field exists. Guest carts require
an absolute expiry, may not select a customer address, and cannot have an idle deadline later than the
absolute deadline. Customer carts forbid the guest-only absolute expiry.

Active carts cannot contain `purgeAt` or a merge target. Merged carts must be guest carts with a
different target cart. Converted carts must belong to a customer. Every terminal status requires an
explicit purge timestamp. This makes accidental TTL deletion of a usable cart invalid before the write
reaches MongoDB.

## Indexes and cleanup

Two partial unique indexes enforce one active document per identity:

- `cart_one_active_per_guest` applies only to active documents with a string guest digest;
- `cart_one_active_per_customer` applies only to active documents with an ObjectId customer.

Terminal history does not block creation of the next active cart. Timeline and expiry-sweep indexes
support customer history and application-enforced expiry. The sole TTL index is
`cart_terminal_purge_ttl` on `purgeAt`, additionally restricted to `merged`, `converted`, and `expired`
statuses. Active documents have no valid TTL value. MongoDB cleanup timing is asynchronous and never
decides whether a cart is usable.

Unit tests cover identity, secret projection, pricing, lines, terminal state, and declared indexes.
MongoDB integration coverage proves the partial unique constraints, actual TTL index, safe terminal
history, and ordinary-query exclusion of the guest digest.
