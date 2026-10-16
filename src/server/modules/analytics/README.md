# Analytics

Owns read-oriented dashboard/report aggregation contracts and metric definitions; it is not a second source of transactional truth. It may consume public query APIs from Orders, Dishes, Customers, and Logs. Any persisted rollup is derived, rebuildable, and private to Analytics.

SK-0162 freezes the measurement vocabulary, timezone, period comparison, financial attribution,
order status groupings, rankings, and view semantics in `docs/dashboard-metrics.md` and the typed
`policy/dashboard-metrics.ts` registry. Later queries must implement that contract rather than
reinterpreting counters or current order state.
