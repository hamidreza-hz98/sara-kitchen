# Customer address management (SK-0177)

`/profile/addresses` is a private, no-store page protected by the customer page guard. The browser reads only `/api/profile/addresses` and the owner-scoped `/api/profile/addresses/eligibility` projection. Writes use the customer CSRF token and never send a customer ID; the server derives ownership from the session. The existing Address repository preserves at most one active default through its unique index and promotes the oldest remaining address when the default is removed.

The page reuses `AddressEditor` and its accessible Leaflet map plus manual latitude/longitude fallback. A new address requires an explicit pin confirmation. Shared browser/server identity and Portuguese postal normalization accept Latin, Persian, and Arabic digits while the server remains authoritative. Errors, empty/loading states, creation, editing, default selection, and deletion are localized in English, Portuguese, and Persian.

The delivery hint uses the same current Porto municipality boundary, published kitchen origin, and optional radius limit as cart selection. It is informative only: cart selection and checkout always reload the address and recalculate eligibility and the fee. If policy data is unavailable, the UI says eligibility is unavailable rather than asserting service.

Deletion always requires confirmation. When the current cart references the address, the dialog explicitly warns that delivery must be chosen again. After deletion, cart listeners are invalidated and refreshed. A stale cart reference cannot pass the existing checkout address validation; the customer must select another eligible address or pickup. The page does not silently convert a delivery order to pickup.

Tests cover list/default/eligibility states, cart-aware deletion confirmation, pin confirmation, browser normalization, Porto/radius decisions, and the existing MongoDB ownership/one-default invariant.
