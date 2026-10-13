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
fields are persistence invariants only; the authoritative engine remains the responsibility of
SK-0138.
