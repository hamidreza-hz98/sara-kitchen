# Cart CRUD and item operations

## Application boundary

`createCartCrudServices` is the only Carts-module application API for active-cart reads and ordinary
mutations. It owns get/create, add item, update quantity, remove item, clear, notes, selected address,
explicit recalculation, and expiry. Callers resolve a cart only from a validated customer session or a
hashed opaque guest credential; browser-provided cart IDs and customer IDs are not mutation selectors.

Every successful read or mutation returns one `CartOperationResult` containing:

- the sanitized persisted cart and its new/current version;
- the complete authoritative line and total calculation from the pricing engine;
- the current availability and maximum lead-time result.

The service never accepts client prices, delivery fees, discounts, totals, availability, expiry, or
version increments. An empty cart is priced as pickup so a retained selected address cannot create a
delivery fee without merchandise.

## Operations

| Operation        | Contract                                                                                                                      |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `get`            | Returns the active cart recalculated against current data, or `null`; it never creates a guest tracking record.               |
| `create`         | Idempotently creates one empty cart for an identity, resolving a unique-index race to the winner.                             |
| `addItem`        | Adds a distinct dish or combines quantity with the existing line, then validates and reprices.                                |
| `updateQuantity` | Requires an existing line and replaces its whole-number quantity.                                                             |
| `removeItem`     | Requires an existing line and removes it before recalculating the remainder.                                                  |
| `clear`          | Removes every line and returns authoritative zero merchandise/delivery totals.                                                |
| `setNotes`       | Trims bounded plain text; an empty value becomes `null`.                                                                      |
| `selectAddress`  | Customer-only; `null` selects pickup, otherwise current ownership/zone resolution precedes delivery pricing.                  |
| `recalculate`    | Persists current prices, discounts, delivery, tax, adjustments, lead time, and a new version without changing customer input. |
| `expire`         | Optimistically transitions the cart to terminal retention and returns its final pricing summary.                              |

All successful mutations slide the guest 30-day idle deadline (never beyond its 90-day absolute
deadline) or the customer 180-day idle deadline. Expired active records are application-transitioned
to `expired` with a 30-day purge date; MongoDB TTL remains cleanup only.

## Optimistic concurrency

Every mutation after creation requires the client's last observed positive `version`. The repository
loads only an active document with that exact business version, increments it once, and saves through
Mongoose optimistic concurrency. The business predicate catches already-stale requests; Mongoose's
`__v` compare-and-swap catches two requests that loaded the same version simultaneously.

A conflict never retries or overwrites automatically. `CartCrudError("conflict")` includes the newly
loaded cart, authoritative pricing, availability, and winning version when the cart remains valid. The
client replaces its local state and may deliberately replay the user's intent. The integration fixture
launches two concurrent repository writes from one observed version and proves exactly one succeeds.

## Availability and pricing

Before persistence, each candidate state runs SK-0139 availability and SK-0138 pricing at the same
server instant. Invalid dish state, quantity, service policy, address/area, or optional stock rejects the
mutation with typed corrections and leaves storage unchanged. Only then is the pricing summary copied
to the Cart document. This guarantees that every successful operation response contains totals derived
from current Dishes data and server-owned policies.

Cart reads also recalculate for display without incrementing the version. Checkout must still rerun the
same policies inside its own consistency boundary; a read or cart mutation is not a reservation.

## Privacy and audit

The repository projection excludes the guest-token digest. CRUD audit events use the customer ID for an
authenticated actor or an anonymous actor with no reference for guests. Dish IDs, notes, addresses,
guest digests, prices, and other customer content are not copied into audit context. Conflicts are
recorded as failed optimistic updates with a stable action name.

## Verification

Unit tests execute the complete operation sequence, combined quantities, changing authoritative dish
prices, delivery selection, empty-cart behavior, stale-version recovery, unavailable-dish rollback,
guest address denial, expiry, totals, versions, and audit outcomes. A MongoDB integration test proves
real simultaneous saves cannot both commit.
