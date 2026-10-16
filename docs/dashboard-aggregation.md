# Dashboard aggregation service

`getDashboardAggregation(connection, actor, {startDate, endDate, asOf})` returns one overview
snapshot. It requires both `dashboard:view` and `analytics:read`. The input is limited to 1–366
Lisbon calendar days, has half-open UTC boundaries, and includes an equal preceding comparison
period. Finance, orders, dishes, categories, customers, and logs expose narrow owner-module reads;
Analytics never opens another module's model.

The result includes EUR-cent sales totals and empty day/month chart buckets; period and comparison
sales; current status tabs; five best customers and sold dishes; lifetime most-visited dishes; eight
recent orders and authorized audit events; and permission-filtered shortcuts. Customer names require
`customers:read-sensitive`. Activity requires `logs:read`. Missing permissions yield anonymous
ranking IDs/labels or an empty activity list, not raw customer or network details.

Money comes from verified append-only transaction events via the
`transaction_financial_event_period` multikey index. Created orders use `order_timeline`; lifecycle
ranking uses `order_status_event_period`; status counts use `order_status_timeline`. Dish ranking uses
`dish_popular_catalog`, category counts use `category_active_status_sort`, customer signups use
`customer_registration_timeline`, and audit recency uses `audit_logs_timeline`. Each query has a
5-second server maximum where aggregation is used. The integration fixture checks independently
calculated capture/refund totals, chart reconciliation, rankings, status counts, Lisbon DST, and an
indexed transaction explain plan.

The current dish-view receipts expire 48 hours after each six-hour window starts. A selected period
beginning more than 42 hours before `asOf` returns `meaningfulDishViews: null` with
`freshness.viewPeriodComplete: false`. The response explicitly labels most-visited dishes as
`lifetime`. A durable private view rollup is needed before longer-period view trends can be shown.
Short supported ranges use each accepted receipt's `createdAt` and the
`dish_view_receipt_period` index, not the six-hour window start.

The per-period top-selling ranking counts completed order-line units and reverses full refunded
orders. Monetary partial refunds do not identify item quantities in the current schema and leave
units unchanged. Historical order-line names remain available after catalog edits.
