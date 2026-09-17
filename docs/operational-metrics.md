# Operational metrics

Operational metrics use the existing structured JSON log stream (`module="metrics"`,
`action="metric.<name>"`). Each event has a numeric `context.value`, a `context.unit` of `ms` or
`count`, a UTC timestamp, and the deployment version. Request ID is retained for correlation in the
outer record, never as a metric dimension. Only short allow-listed dimensions are permitted; no
customer, order, URL, query, filename, payment payload, or MongoDB command/reply body is collected.

This is an intentionally provider-neutral foundation: ship production JSON logs to the deployment
log sink, retain at least 30 days, and build the seven panels below. Sentry remains the error and
sampled-trace service; it is not the authoritative count source because traces may be sampled.

| Panel                    | Event and filter                         | Aggregation                                        | Current source                                                       |
| ------------------------ | ---------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------- |
| Request errors           | `metric.http.request`, `statusClass=5xx` | Count, 5xx / all requests                          | Every shared API handler response                                    |
| Request latency          | `metric.http.request`                    | p50/p95/p99 of `value` (ms) by method/status class | Every shared API handler response                                    |
| Database latency/failure | `metric.database.command`                | p50/p95/p99 (ms), failures by command              | MongoDB driver command completion events                             |
| Upload failures          | `metric.media.upload.failure`            | Sum `value` by reason                              | Emit at terminal upload failure when media workflow is built         |
| Checkout attempts        | `metric.checkout.attempt`                | Count started/succeeded/failed                     | Emit at validated checkout start and terminal outcome                |
| Payment outcomes         | `metric.payment.outcome`                 | Count by provider/outcome                          | Emit once per committed transaction status transition                |
| Webhook delay            | `metric.webhook.delay`                   | p50/p95/p99 (ms), rejected count                   | Emit after verified provider event with trusted provider timestamp   |
| Orders                   | `metric.order.created`                   | Sum `value` by fulfillment                         | Emit once after committed order creation, never on idempotent replay |

The last five rows are **contracts, not live measurements yet**: media upload, checkout, payment,
webhook processing, and order creation are not implemented in the repository. Zero events must be
shown as “not instrumented/no data”, not as a zero failure or zero sales rate. Those modules must
call the public `recordOperationalMetric()` API as their workflows land. Emit business counters only
after the corresponding state transition is durably committed and guard against replay/duplicate
webhooks. A rejected upload emits exactly one failure at its terminal boundary. Webhook delay is
`max(0, processing completion time − provider-signed event time)`, never a client-provided timestamp.

## Query recipes

For a log service with SQL syntax, normalize JSON fields to `action`, `timestamp`, `context.value`,
and the named dimensions. Use a bounded time window, e.g. `timestamp >= now() - interval '24 hours'`.

```sql
-- Request error rate and latency distribution (repeat percentiles for other panels).
SELECT count(*) AS requests,
       sum(CASE WHEN context.statusClass = '5xx' THEN 1 ELSE 0 END) AS server_errors,
       100.0 * sum(CASE WHEN context.statusClass = '5xx' THEN 1 ELSE 0 END) / nullif(count(*), 0) AS error_pct,
       approx_percentile(context.value, 0.50) AS p50_ms,
       approx_percentile(context.value, 0.95) AS p95_ms,
       approx_percentile(context.value, 0.99) AS p99_ms
FROM logs WHERE module = 'metrics' AND action = 'metric.http.request'
  AND timestamp >= now() - interval '24 hours';

-- Database command latency and errors.
SELECT context.command, context.outcome, count(*) AS operations,
       approx_percentile(context.value, 0.95) AS p95_ms
FROM logs WHERE module = 'metrics' AND action = 'metric.database.command'
  AND timestamp >= now() - interval '24 hours'
GROUP BY context.command, context.outcome;

-- Reuse this pattern for upload/checkout/payment/order counts.
SELECT action, context.reason, context.outcome, context.provider, context.fulfillment,
       sum(context.value) AS total
FROM logs WHERE module = 'metrics' AND context.unit = 'count'
  AND timestamp >= now() - interval '24 hours'
GROUP BY action, context.reason, context.outcome, context.provider, context.fulfillment;

-- Webhook delivery delay by provider and result.
SELECT context.provider, context.outcome, count(*) AS events,
       approx_percentile(context.value, 0.95) AS p95_ms
FROM logs WHERE module = 'metrics' AND action = 'metric.webhook.delay'
  AND timestamp >= now() - interval '24 hours'
GROUP BY context.provider, context.outcome;
```

The exact percentile function and JSON path syntax vary by log provider; map these field names in
the deployment dashboard rather than changing the application event contract. Suggested initial
alerts: 5xx rate > 2% for 10 minutes with at least 50 requests, request p95 > 1.5 seconds,
database p95 > 250 ms, any sustained upload/payment failure spike, webhook p95 > 60 seconds, and
missing order events during known ordering hours. Tune against real traffic before paging.

MongoDB command monitoring is enabled explicitly and records only command name, duration, and
outcome. It never inspects `command`, `reply`, or `failure`; the observer is attached once per live
client across serverless reuse. Per-command logging has cost, so measure volume/overhead during load
tests and switch to a bounded aggregation/exporter if it becomes material. [MongoDB's driver
documentation](https://www.mongodb.com/docs/drivers/node/current/monitoring-and-logging/monitoring/)
describes the command events and the `monitorCommands` option.
