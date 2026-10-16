# Payment result (SK-0160)

`/payment-result?order=SK-...` is a protected customer route. The order query value is a lookup key, not proof of payment or ownership. The server requires an active customer session and queries the order by both code and customer ID. Missing, malformed, and non-owned orders do not render a result. Other query parameters—including `status=success`—are ignored.

The customer-safe result service cross-checks the latest transaction's order, customer, currency, and requested amount. Success requires both a settled payment (`paid` or `partially-refunded`) and an order that has passed payment confirmation. A paid transaction paired with an unconfirmed order remains pending, which fails closed during an inconsistent or delayed update. No provider references, response codes, raw events, phone numbers, or address data reach this page.

While pending, the client polls the authenticated, no-store `/api/profile/payment-result` endpoint every 2.5 seconds. Transient failures retry, and automatic polling pauses after roughly two minutes with a manual refresh option. A delayed verified webhook therefore changes the same page to the authoritative terminal state. The page warns customers not to submit a duplicate order while the result is unknown. Failed, expired, or cancelled attempts link to a new menu flow rather than re-initiating the old payment; refund results do not offer another charge.

The page and API are private/no-index surfaces. English, Portuguese, and Farsi guidance covers pending, success, failure, expiry, cancellation, and refund outcomes.
