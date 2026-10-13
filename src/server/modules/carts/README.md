# Carts

Owns guest/customer cart identity, line quantities, optimistic versioning, expiry, merge behavior, selected-address reference, notes, and calculated cart totals. It may consume Customers, Dishes, and Addresses through public APIs. Client-supplied prices are never authoritative.

Cart identity and lifecycle are governed by
[`ADR-0009`](../../../../docs/adr/0009-server-side-cart-identity.md): guest carts use a hashed
256-bit opaque token whose raw value exists only in an HTTP-only cookie; authenticated sessions share
one customer cart across devices; and sign-in merge is transactional, idempotent, and non-destructive
on failure. Active documents are expired by application policy, while TTL cleanup applies only after a
terminal cart receives its purge timestamp.
