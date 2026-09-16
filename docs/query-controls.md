# List query controls (SK-0042)

All paginated Route Handlers should use `createListQueryControls()` from `@/server/database` and pass the resulting plan to their owning module's repository. The shared contract uses **page-based pagination**. A module declares its allowed top-level filter, sort, and projection fields. Do not pass raw `URLSearchParams` or client-provided objects to Mongoose.

Example request: `?page=2&pageSize=20&sortBy=name&sortDirection=asc&status=active&search=soup&fields=name,status`.

The defaults are page 1 and size 20. Size is limited to 100 and `page * pageSize` to 10,000 to cap offset scans. Deep browsing will require a separately designed cursor endpoint. Repeated, unknown, malformed, and out-of-window parameters return a localized 400 validation error. Filters are optional but must have module-specific Zod schemas; only validated scalar strings, numbers, and booleans reach MongoDB. Modules should bound individual string lengths and use enums where possible.

Search uses the indexed `normalizedSearchText` convention: Unicode normalization, minimum two and maximum 80 input characters, regex escaping, and an anchored prefix expression. Search is opt-in per collection; collections that enable it must populate and index the normalized field. Search is not a general full-text or substring search. Collection-specific indexes and query explain plans remain the owning module's responsibility.

Sort uses only configured fields and always adds `_id` as a deterministic tie-breaker. A module must index its supported sort/filter combinations before exposing a large collection. Projection is inclusion-only and always includes `_id`; the explicit field allowlist must omit sensitive fields. The repository still maps results to authorized DTOs; query projection alone is not a privacy boundary. Soft-delete predicates and tenant/authorization scope are added by the owning repository, never received from the query string.

Use `pageResult(items, totalItems, plan)` after a count with the same scoped filter. It yields `{data, meta}` for `apiSuccess(data, {meta})`; `meta.pagination` always contains `page`, `pageSize`, `totalItems`, `totalPages`, `hasNextPage`, and `hasPreviousPage`, plus the effective sort. Counts and pages are not an atomic snapshot under concurrent writes. For workflows requiring immutable traversal, use an explicit snapshot/cursor design.

Unit tests cover malformed and costly inputs, allowlists, escaping, projection, and metadata. An integration test executes filtered, searched, projected, stable pagination against MongoDB.
