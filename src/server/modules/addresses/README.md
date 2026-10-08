# Addresses

Owns customer address records, recipient details, GeoJSON coordinates, postal data, default-address invariant, and address ownership policies. It may consume Customers’ public API. Orders copy immutable delivery snapshots instead of relying on mutable address records.

SK-0129 adds the private Address schema, write validation, ownership policy, and deterministic default-address planning rules. `formattedAddress` and `deliveryNotes` are locale-neutral recipient input. The location is stored in GeoJSON longitude/latitude order, postal codes use Portuguese `NNNN-NNN`, and a partial unique index permits at most one active default per customer.

SK-0130 adds owner-scoped customer CRUD/default operations, read-only sensitive admin access, audit events, and a checkout resolver that reloads the address and evaluates the current delivery-zone policy. Callers outside this module use only the exports from `index.ts`; they never query the Address model directly.
