# Categories

Owns category translations, slug, status, ordering, media references, and category CRUD invariants. It may consume Media’s public API to validate references. Dish membership/counts are obtained through public Dish queries or analytics orchestration, never by importing Dish persistence code.

The Category model stores required English name/description in `translations`, optional
Portuguese/Persian entries, a stable slug generated from the English name on first
validation, image-only media IDs, a status, sort order, optional SEO page ID, base
audit/timestamps, and soft-delete metadata. The unique slug index reserves slugs
even after soft deletion so old public links are never reassigned. Future create/update
services should use `resolveUniqueSlug()` for collision suffixes and deliberate admin
overrides, retry duplicate-key races, and call `validateCategoryMediaReferences()`
before persisting media IDs. That helper queries Media through its public API and
rejects missing, deleted, unready, or non-image assets without crossing model
boundaries. The `seoPageId` reference is an optional link; SEO record lifecycle is
owned by the SEO module.

The CRUD service uses the real MongoDB repository and enforces action-level admin
permissions, translation/input validation, collision-safe slug selection,
archive-before-soft-delete, dish-reference checks, audit outcomes, and targeted
category/SEO cache-tag invalidation. SEO synchronization and Dish reference counting
are **required injected ports**, not no-op fallbacks. Their production adapters
cannot be wired until the SEO and Dish modules are implemented. Route handlers
in SK-0085 will also need to supply the request-scoped audit sink and media
reference validator. Do not expose the service through an endpoint with dummy
ports. For a fully atomic catalog/SEO/audit write, the eventual adapters should
share a MongoDB transaction or durable outbox; a port failure after a category
write currently requires repair/retry. Media usage-count reconciliation is likewise
required before live category mutations are enabled.

The `/api/categories` list/detail handlers are live for authorized admins and
return bounded page metadata. Create, update, and archive handlers share Zod
request schemas, CSRF/permission checks, and domain-to-API error mapping. Their
mutation-service resolver deliberately returns unavailable (503) in production
until the required adapters above are present; it runs before any category write.
Contract tests exercise success paths with an injected service and verify that
the live gate cannot mutate data. This gate must not be removed merely to expose
the dashboard forms.
