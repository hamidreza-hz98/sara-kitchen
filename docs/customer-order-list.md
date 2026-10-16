# Customer order list (SK-0178)

`/profile/orders` is a private, server-rendered customer page. Authentication is required before querying orders; every list, count, and detail query includes the resolved customer ID. The companion `GET /api/profile/orders` uses the same customer-scoped service and returns `Cache-Control: private, no-store`. Neither route accepts a customer ID from the browser.

The list has shareable `tab`, `status`, and `page` URL parameters. Tabs group orders into all, active (`pending_payment`, `confirmed`, `preparing`, `ready`, `out_for_delivery`), completed, and closed (`payment_failed`, `cancelled`, `expired`, `refunded`). The optional exact-status filter resets the tab to all; changing tabs clears the exact-status filter. Eight orders appear per page, newest first. Counts reflect the signed-in customer's orders, independent of the current filter. Invalid query values return not found; a valid page beyond the result set shows an empty state.

The database projection contains only code, status, creation date, fulfillment method, immutable item names and quantities, and the authoritative total in cents. It excludes customer identity, address, payment internals, and other customers' records. List and detail responses are not publicly cached or indexed. The code link opens an owner-checked summary destination; the full order detail experience is SK-0179.

Coverage: integration tests verify status grouping, pagination, exact filtering, and cross-customer isolation for both list and direct detail lookup. Component tests cover rendered summaries, links, tabs, pagination, and empty state.
