# Order list dashboard (SK-0158)

`/dashboard/orders` uses the supplied dashboard's warm card, recent-order table, and status-chip language. The supplied exports did not include a separate management order-list screen, so this page extends those established patterns into a responsive desktop table and mobile cards.

The page requires `orders:read`; the API independently enforces the same permission. Customer names/mobile search require `orders:read-sensitive`. Status progression and cancellation actions render only when the corresponding permissions exist, use the existing server-authorized state machine, and require confirmation for cancellation. Order summaries open in a URL-addressable drawer; the dedicated order-details page remains a later task.

The URL carries status tab, code/customer/mobile search mode and text, inclusive UTC date bounds, payment state, sort, page, page size, and selected order. The API returns paginated rows plus status counts and a total value computed under identical non-status filters. Selecting a tab changes only the status constraint, so its count agrees with the list; other filters update every tab together. Stable `_id` tie-breaking prevents ambiguous pagination. Dates use UTC day boundaries until a Porto-local business-date policy is implemented.

The payment filter reads the final payment status recorded in each order's append-only history. It is exact but currently uses a MongoDB expression rather than a materialized indexed field; large-scale order growth should trigger a measured query-plan review and migration. Mobile-prefix search has an index; customer-name prefix search is bounded and administrator-only. No client-supplied amount or status can alter the financial record.

Integration tests verify status totals and combined customer, mobile, payment, date, and sort filters. Component tests verify tab counts, URL updates, request reconstruction from a shared URL, permission-gated controls, and cancellation confirmation. All three launch locale catalogs include the list labels and status/payment text.
