# Dashboard metric contract

This document is the measurement source of truth for the overview dashboard. Analytics is a
read-only projection: Orders, Transactions, Customers, Dishes, Categories, and Logs remain the
authoritative records. Money is always integer EUR cents and is formatted only at the UI boundary.

## Time and comparison rules

- Business timezone: IANA `Europe/Lisbon`, including its daylight-saving transitions. MongoDB dates
  remain UTC instants; calendar boundaries are converted to UTC only after resolving Lisbon time.
- Intervals are half-open: `[start, end)`. An event exactly at `end` belongs to the next interval.
- Default overview period: the current 30 Lisbon calendar days through `asOf`, including today.
- Presets use local calendar boundaries: today, previous 7 days plus today, previous 29 days plus
  today, current calendar month, and current calendar year. Custom ranges use inclusive local dates
  and an exclusive midnight after the selected end date.
- Comparison is the immediately preceding range with the same count of Lisbon calendar days and the
  same local-time cutoff on its final day. Calendar arithmetic is used, not a fixed millisecond
  subtraction, so DST does not shift a boundary.
- Change percentage is `(current - previous) / abs(previous) * 100`. When previous is zero, change is
  `null` (shown as “not available”), never infinity. Counts and cents use unrounded source values;
  only displayed percentages round to one decimal place.
- Every response carries `period`, `comparisonPeriod`, `asOf`, `timezone`, and data freshness. The
  launch target is no more than five minutes of analytics lag. As-of inventory counters are snapshots
  at query time and do not receive period comparisons unless historical snapshot facts exist.

## Financial metrics and sales chart

Transaction event history is the source of financial truth. Current order status is never used to
infer revenue.

| Metric              | Exact formula                                                 | Inclusion and attribution                                                                                                                             |
| ------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gross sales         | `Σ capture-event amountCents`                                 | Verified transition to `paid`; attributed by provider `occurredAt`. A captured order remains in gross sales after cancellation or refund.             |
| Refunds             | `Σ refund-event amountCents`                                  | Both partial and full verified refunds; attributed to the refund event period, even when capture occurred earlier. Displayed as a positive magnitude. |
| Net sales           | `gross sales − refunds`                                       | May be negative when a period contains refunds for older sales. Delivery, tax, and adjustments are already represented in the captured order total.   |
| Paid orders         | Distinct `orderId` with its first capture event in the period | A partial/full refund does not remove the order. Idempotent provider events count once.                                                               |
| Average order value | `gross sales / paid orders`                                   | Integer-cent result rounded half away from zero; `null` when there are no paid orders.                                                                |

The sales chart buckets these same three money formulas by Lisbon calendar day (or month when a
selected range exceeds 93 days). Empty buckets are emitted with zeros. Bucket totals must reconcile
exactly to the summary cards. Authorized, created, pending, failed, cancelled, and expired payments
contribute zero. Tax remains zero under the MVP `disabled_mvp` policy; tax is not silently estimated.

## Orders and status tabs

`Orders created` is the distinct count of order IDs whose immutable `createdAt` is in the selected
period, regardless of later outcome. This measures demand attempts and therefore includes unpaid,
failed, expired, cancelled, and refunded orders. It must not be labelled “sales”.

Status-tab counts are current operational workload at `asOf`, not period event counts:

| Tab              | Current statuses                                      |
| ---------------- | ----------------------------------------------------- |
| Awaiting payment | `pending_payment`                                     |
| Paid / active    | `confirmed`, `preparing`, `ready`, `out_for_delivery` |
| Completed        | `completed`                                           |
| Unsuccessful     | `payment_failed`, `expired`                           |
| Cancelled        | `cancelled`                                           |
| Refunded         | `refunded`                                            |

Each order appears in exactly one tab. “Recent orders” sorts by `createdAt DESC, _id DESC`; “recent
activities” sorts audit records by `occurredAt DESC, _id DESC`. Neither list changes metric totals.

## Customers

- **Unique paying customers:** distinct immutable `customerId` values attached to a verified capture
  event in the selected period. Multiple orders count once. Guest orders are unavailable under the
  customer-checkout decision and therefore are not a separate segment.
- **Registered customers:** customer records created in the period. Disabled and later-anonymized
  accounts remain included so historical acquisition totals do not change.
- **Best customer:** group financial events by `customerId`, calculate period net spend as captured
  cents minus refunded cents, and select the greatest positive value. Tie-break by gross captured
  cents descending, paid-order count descending, then stable customer ID ascending. Return `null`
  when no customer has positive net spend. The UI uses current safe customer data; anonymized records
  display an anonymized label and never recover snapshot PII.

“Best customers” uses the same ranking and formula, limited after sorting. Refunds in the current
period reduce the customer even when the original purchase predates the period; net spend can be
negative but negative/zero rows are omitted from the best-customer list.

## Catalog and content

- **Published dishes:** current count where `status = published` and `deletedAt = null`. Availability
  scheduling does not change this catalog count; an availability filter may be shown separately.
- **Published categories:** current count where `status = published` and `deletedAt = null`.
- **Meaningful dish views:** accepted detail-view facts in the selected period after bot/prefetch
  rejection, at least three seconds of visible engagement, and one count per dish plus privacy-safe
  visitor fingerprint per six-hour UTC window. This is a unique _dish-view window_, not a unique
  human or unique site visitor. A person viewing two dishes may contribute two views. The lifetime
  `Dish.viewCount` can rank “most visited overall” but cannot answer period trends by itself; period
  dashboards require a private, rebuildable analytics fact/rollup with no raw IP or user agent.
- **Top-selling dish:** for each immutable order line, add quantity when its order first becomes
  `completed`; subtract the refunded quantity when a verified partial/full refund effect occurs.
  Attribute each delta by its lifecycle event time and rank the greatest positive net units. Tie-break
  by gross completed units descending, net line revenue descending, then stable dish ID ascending.
  Return `null` when no dish has positive net units. Archived/deleted dishes retain their snapshot
  label and historical contribution. Retries and repeated transitions contribute no duplicate delta.
- **Most visited dishes:** rank accepted view facts descending for a selected period; ties use the
  current translated name ascending and dish ID ascending. “Lifetime” may instead rank the monotonic
  `viewCount` counter and must be explicitly labelled lifetime.

## Summary invariants

1. Gross, refund, and net chart totals equal their summary cards for the same query.
2. `netSalesCents = grossSalesCents - refundsCents` exactly; floating-point money is forbidden.
3. Status tabs are mutually exclusive and their sum equals all non-deleted current orders.
4. Metrics use event `occurredAt` for business facts and `recordedAt` only for operational lag.
5. Provider/webhook retries never create extra revenue, orders, sold units, views, or customers.
6. Locale changes labels and formatting only; it never changes boundaries or numeric results.
7. Permissions apply before aggregation output. Dashboard overview requires `dashboard:view`; any
   customer-identifying ranking additionally requires the approved customer-sensitive read policy.
