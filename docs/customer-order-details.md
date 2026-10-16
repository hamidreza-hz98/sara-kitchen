# Customer order details (SK-0179)

`/profile/orders/[orderCode]` resolves the customer session before querying. The Orders module finds the order by **both** code and authenticated customer ID; malformed, absent, and other-customer codes share a not-found result. The page is dynamic, private, and `noindex`.

The customer projection uses the checkout-time item names, quantities, portion sizes, unit and line prices, address/recipient, notes, pricing, and fulfillment timing. It does not re-fetch editable dishes, addresses, or customer profile fields. The timeline comes from append-only order status history. The latest payment state is displayed only if its transaction matches the order, customer, currency, and original total; otherwise it is shown as unavailable. Internal notes, provider references, transaction IDs, actor IDs, and other management fields are omitted.

Actions follow the existing state machine. Online cancellation appears only for an awaiting-payment order whose provider payment is already verified `cancelled`; the mutation additionally checks ownership, CSRF, revision, and transition rules. Otherwise the customer is directed to contact the kitchen for cancellation/refund. An awaiting-payment order links to its verified payment-result page. Failed, expired, or cancelled orders offer a **new** order from the menu, not an unimplemented same-order payment retry. One-click reorder is omitted pending product approval and current-catalog/availability rules.

Coverage includes owner-isolated integration reads, snapshot/payment projection checks, cancellation gating, and component tests for the timeline, totals, contact, cancellation confirmation, and failure recovery.
