# Address model

## Ownership and lifecycle

Addresses are owned by the Addresses module and persisted in the `addresses` collection. Each record has an immutable `customerId`; access checks compare that owner with the authenticated customer rather than accepting a customer identifier from request data. Admin access remains a separate permission decision for SK-0130.

Addresses use the shared schema conventions for ObjectId identity, timestamps, actor provenance, schema version, normalized search text, JSON serialization, and soft deletion. Orders must copy an immutable delivery snapshot and must never depend on a mutable address after checkout.

## Delivery data

- `name` is the customer's short label, such as Home or Work.
- `recipientName` and `recipientMobile` are normalized with the same public identity rules as Customer.
- `formattedAddress` and `deliveryNotes` are locale-neutral, recipient-entered delivery facts. They are not CMS content and are not translated.
- `postalCode` normalizes whitespace or localized digits to the Portuguese `NNNN-NNN` format.
- `location` is strict GeoJSON: `{ type: "Point", coordinates: [longitude, latitude] }`. Longitude is bounded to -180…180 and latitude to -90…90.

## Validation metadata

The embedded `validation` object stores only an allow-listed status, provider, provider reference, and check timestamp. Raw geocoder responses are deliberately excluded. Unverified records carry no provider data; verified or failed checks require a provider and timestamp. Supported provider codes are `manual`, `nominatim`, and `google_maps` so future provider changes do not require arbitrary executable metadata.

## Default invariant

A partial unique index guarantees at most one active `isDefault: true` record per customer. Domain planning rules additionally require:

1. the first active address becomes the default even when the request does not select it;
2. explicitly selecting a later default unsets the current default in the same consistency boundary;
3. removing the default promotes the first remaining address in repository-defined stable order;
4. a customer with no active addresses has no default.

SK-0130 must execute replacement writes atomically where MongoDB transactions are available and fail closed if it cannot preserve these rules.

## Indexes

- customer, active/deleted state, creation time, and identifier for owner-scoped lists;
- `2dsphere` on location for delivery-distance queries;
- partial unique customer/default index for one active default.
