# Dashboard overview

`/dashboard` consumes the permission-scoped Analytics snapshot from SK-0163/0164. It never
recalculates sales, order counts, or rankings in the browser. The four primary cards use period
net sales, period customer registrations, period order creations, and current published dishes.
Only metrics with an equivalent previous-period value show a percentage comparison; published
dishes have no historical snapshot and therefore no invented growth rate.

Date presets select today, the last seven days, the last 30 days, or the last 365 days in
`Europe/Lisbon`. Custom ranges are inclusive calendar dates, validated to 1–366 days with no
future end date before any aggregate runs. Selection and the recent-order group are URL state.
The recent-order group filters the eight-item preview only; its count badges are authoritative
current status-group totals, so a count can exceed the visible preview. Full order work happens
on `/dashboard/orders`.

The sales chart groups contiguous source buckets into at most twelve bars. Grouping sums gross,
refund, and net cents exactly, and each bar has non-visual text with its period and all three
values. An empty source shows an explicit state. The visual bars show gross sales, not a misleading
net-sales approximation when refunds exceed captures. The sales-summary panel shows the selected
period's gross, refunds, net, paid-order count, and average order value; it does not fabricate
24-hour or seven-day values from a 30-day response.

Top-selling dishes, lifetime most-visited dishes, best paying customers, and safe recent audit
events each have an empty state. Activity and identifying customer names follow the Analytics
permission projection. Quick actions and deep links require their corresponding dashboard grants.
The dashboard timestamp is the cached data-generation time, formatted for the selected locale in
the business timezone. Loading skeletons, a recoverable error boundary, and invalid-date recovery
complete the route states. The grid collapses to one main column on narrow viewports; cards use two
columns, actions wrap, order rows stack, and chart bars may scroll horizontally rather than clip.

The layout follows the supplied harmonized light dashboard export, while reusing the approved
brand theme and existing dashboard shell. The supplied HTML is treated as visual evidence only.
Tests cover date bounds, chart-total preservation, authoritative card values, chart text
alternatives, empty states, and permission-aware affordances. Production-like responsive and
accessibility audits remain part of SK-0192/SK-0193/SK-0194.
