# Dashboard cache and freshness

The protected overview reads `getCachedDashboardAggregation`. Authentication and the
`dashboard:view` plus `analytics:read` checks occur on every request, before cache access.
The cache key includes the selected locale, period, 30-second as-of bucket, and the four
permissions that change the projection (activity, customer names, order shortcuts, catalog
shortcut). It never contains a session token or raw administrator ID. The source queries remain
owned by their modules; Analytics does not read cross-module models directly.

Next's Data Cache stores a snapshot for at most 30 seconds with the
`sk:v1:analytics:dashboard` tag. The snapshot carries its true `freshness.generatedAt` ISO
timestamp. `/dashboard` renders this in the viewer's locale and the business timezone
(`Europe/Lisbon`). It is a data timestamp, not the page-render time. A change in selected date
range or locale gets a separate snapshot. The 30-second bucket prevents an unbounded number of
keys from per-request `Date.now()` values.

Checkout creation, admin/customer order transitions, transaction attachment, payment webhooks,
admin refund/cancel/reconciliation actions, and the reconciliation worker expire the tag **after**
their durable operation returns. No cache API is called from within a MongoDB transaction. A
replayed checkout or duplicate webhook does not require an extra invalidation. Cache failure does
not turn an already-committed mutation into a retriable API error; it emits a structured warning
and the finite lifetime is the backstop. Non-order inputs (catalog, customer, and audit changes)
also become visible on the next 30-second bucket; precise invalidation can be added when their
dashboard surfaces are expanded.

The agreed launch freshness objective is **at most five minutes** (SK-0162). This implementation
uses a 30-second revalidation cadence and immediate tag expiry after committed order/payment
changes, leaving room for the first stale-while-revalidate read and transient cache propagation.
The warm-cache service
latency objective is **p95 under 500 ms** in the chosen deployment region; cold aggregation is
bounded by its indexed queries and 5-second per-aggregation MongoDB limit. Unit tests verify
cache hits, projection isolation, tag expiry, and failure fallback. Production-like p95 latency
and cross-instance freshness must be measured at SK-0194 performance testing before launch; a
local mock cannot certify either target.
