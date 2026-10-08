# Addresses

Owns customer address records, recipient details, GeoJSON coordinates, postal data, default-address invariant, and address ownership policies. It may consume Customers’ public API. Orders copy immutable delivery snapshots instead of relying on mutable address records.

SK-0129 adds the private Address schema, write validation, ownership policy, and deterministic default-address planning rules. `formattedAddress` and `deliveryNotes` are locale-neutral recipient input. The location is stored in GeoJSON longitude/latitude order, postal codes use Portuguese `NNNN-NNN`, and a partial unique index permits at most one active default per customer. CRUD orchestration and transaction-backed default replacement belong to SK-0130.
