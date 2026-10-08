# Address CRUD and checkout ownership

SK-0130 implements customer-owned address management without exposing the private Address model across module boundaries.

## HTTP surface

Customer routes require a valid customer session. Mutations also pass the shared origin/CSRF checks.

- `GET /api/profile/addresses`
- `POST /api/profile/addresses`
- `GET|PATCH|DELETE /api/profile/addresses/:addressId`
- `POST /api/profile/addresses/:addressId/default`

Management routes are intentionally read-only and require `addresses:read-sensitive`:

- `GET /api/customers/:customerId/addresses`
- `GET /api/customers/:customerId/addresses/:addressId`

An administrator cannot create, modify, select the default, or delete an address through this module. Those actions remain customer-owned.

## Ownership and disclosure

The authenticated customer's ID is the owner ID supplied to every profile operation. Repository reads combine `customerId`, address `_id`, and `deletedAt: null` in one query. A valid address ID owned by another customer is therefore indistinguishable from a missing address and returns the standard not-found contract; no foreign address fields are disclosed.

Admin reads require the explicit sensitive-address permission at both route authentication and service authorization layers. UI visibility is not an authorization control.

## Default-address consistency

The first active address becomes default. Selecting a new default clears the prior default, and deleting the default promotes the oldest active survivor. The partial unique index remains the final protection against two active defaults. The repository uses optimistic document versions and returns a conflict for concurrent changes. On standalone local MongoDB, multi-document changes use bounded compensation; production deployments that support transactions may wrap the service call in a transaction without changing its public contract.

## Checkout eligibility

Creating or editing an address validates its shape, Portuguese postal code, and GeoJSON coordinate order, but it does not persist a permanent delivery-eligible decision. `resolveAddressForCheckout` reloads the customer-owned active address and invokes the caller-provided current delivery-zone calculator on every checkout attempt. Checkout must fail when ownership is absent or the current Porto service-area policy says the point is ineligible. This keeps later changes to the kitchen location, coverage boundary, or distance rules authoritative.

## Privacy and audit

Create, read, update, delete, and default-selection attempts emit English audit action codes. Audit context contains only action, customer ID, resource ID, actor, outcome, request ID, and sanitized request metadata. Recipient names, phone numbers, formatted addresses, delivery notes, and coordinates are deliberately excluded.
