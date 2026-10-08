# Activity-log management UI

`/dashboard/activity` is a read-only, responsive view over the append-only audit timeline. The page and its API independently require an active administrator with `logs:read`; navigation visibility is not an authorization control.

## Query and navigation contract

The URL retains page size, page, date range, actor kind/reference, canonical action code, resource kind/reference, event type, severity, outcome, request ID, and the selected event. Applying or clearing filters returns to page one. The server validates every query, caps pages at 100 records and the browse window at 10,000 records, and selects an index aligned to request ID, actor, resource, action, classification, or the default timeline.

The date controls represent inclusive UTC calendar-day boundaries. Results are ordered by occurrence time and stable `_id` tie-breaker. Desktop uses a table; compact screens use keyboard-operable cards. Both open the same details drawer, and the selected event remains addressable through `event` in the URL.

## Privacy and rendering

The API maps database rows through the Logs module's safe projection. It never returns IP addresses, IP hashes, expiry metadata, or internal persistence fields. The drawer exposes only the network retention policy, bounded user-agent text, immutable English event data, actor/resource snapshots, and scalar sanitized context.

Messages, snapshots, identifiers, user agents, and context values render through React text nodes. No audit value is interpreted as HTML. Context remains flat and scalar by schema, preventing arbitrary nested payload display. Reads are themselves audited with filter counts rather than raw filter values.

## Acceptance evidence

- unit coverage verifies authorization, filter validation, classification filtering/index selection, bounded pagination, and safe DTO mapping;
- component coverage verifies URL filter persistence and inert rendering of markup-like context;
- locale catalogs provide English, Portuguese, and Persian labels;
- the dashboard page guard and API guard both enforce `logs:read`.
