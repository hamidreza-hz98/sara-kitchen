# Analytics

Owns read-oriented dashboard/report aggregation contracts and metric definitions; it is not a second source of transactional truth. It may consume public query APIs from Orders, Dishes, Customers, and Logs. Any persisted rollup is derived, rebuildable, and private to Analytics.

SK-0162 freezes the measurement vocabulary, timezone, period comparison, financial attribution,
order status groupings, rankings, and view semantics in `docs/dashboard-metrics.md` and the typed
`policy/dashboard-metrics.ts` registry. Later queries must implement that contract rather than
reinterpreting counters or current order state.

SK-0163 implements the bounded read projection in `service/dashboard-aggregation.ts`. Each source
module exposes only its own narrow dashboard query API; Analytics combines those results and enforces
`analytics:read`. Recent activity and identifying customer labels have separate permission gates.
See `docs/dashboard-aggregation.md` for query plans and the view-retention limitation.
