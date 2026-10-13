# Carts

Owns guest/customer cart identity, line quantities, optimistic versioning, expiry, merge behavior, selected-address reference, notes, and calculated cart totals. It may consume Customers, Dishes, and Addresses through public APIs. Client-supplied prices are never authoritative.

Cart identity and lifecycle are governed by
[`ADR-0009`](../../../../docs/adr/0009-server-side-cart-identity.md): guest carts use a hashed
256-bit opaque token whose raw value exists only in an HTTP-only cookie; authenticated sessions share
one customer cart across devices; and sign-in merge is transactional, idempotent, and non-destructive
on failure. Active documents are expired by application policy, while TTL cleanup applies only after a
terminal cart receives its purge timestamp.

SK-0137 adds the private Cart model documented in
[`docs/cart-model.md`](../../../../docs/cart-model.md). Its partial unique indexes enforce one active
cart for each guest digest or customer, and its only TTL index is restricted to terminal records with
an explicit purge timestamp. `guestTokenHash` is excluded from normal queries and JSON output. Pricing
fields are persistence invariants only.

SK-0138 adds the server-only pricing engine documented in
[`docs/cart-pricing-engine.md`](../../../../docs/cart-pricing-engine.md). It loads current dish prices
through the Dishes public API, applies unit discount rounding and schedules, calculates delivery from
server policy, keeps MVP tax explicit at zero, applies bounded server adjustments, and returns an
immutable integer-cent snapshot. Browser-supplied prices and totals are never inputs to the calculation.

SK-0139 adds the shared availability policy documented in
[`docs/cart-availability.md`](../../../../docs/cart-availability.md). Cart mutations and checkout use
the same authoritative checks for dish lifecycle/schedules, quantity, maximum lead time, configured
service hours and cutoff, fresh delivery-area eligibility, and optional future stock. Stale conditions
return typed, localized corrections and never silently remove or change a customer's line.
