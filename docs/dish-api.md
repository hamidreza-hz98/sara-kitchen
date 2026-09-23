# Dish API (SK-0098)

All responses use the shared JSON API envelope and request ID. Validation failures contain only
field-safe localized issues; unexpected errors never expose stack traces. Routes run in the Node.js
runtime because Mongoose and the media/reference adapters are server-only.

## Public reads

- `GET /api/dishes` lists published, non-deleted dishes. It accepts locale/fallback locale, bounded
  search and pagination, category, current availability, featured/discounted, dietary/allergen,
  allow-listed sort, and grid/list-view parameters. Repeat `dietaryTags` and `excludeAllergens` keys
  for multiple filters.
- `GET /api/dishes/{slug}` returns one published, non-deleted localized detail projection including
  description, specifications, ingredient snapshots, pricing, availability, allergens, and related
  entity IDs. IDs, status/version metadata, and other management-only fields are not exposed.

Public list and detail requests use independent MongoDB-backed per-IP fixed windows. The production
proxy must overwrite `X-Forwarded-For`; invalid/unavailable source addresses intentionally share the
`unknown` bucket. Bucket keys are HMAC-SHA256 values and raw addresses are never persisted. A rejected
request returns the shared 429 shape and `Retry-After`.

Successful public responses use `public, s-maxage=60, stale-while-revalidate=300`. This bounds stale
CDN content to the documented one-minute freshness target. `Vary: Cookie` keeps the browser-selected
locale from crossing cache variants when no explicit locale query is supplied. The shared response
wrapper preserves an explicit handler cache policy and defaults every other response—including errors,
management reads, and mutations—to `no-store`.

## Management routes

- `GET /api/dishes/manage` requires `dishes:read` and returns the administrative list.
- `GET /api/dishes/manage/{dishId}` requires `dishes:read`.
- `POST /api/dishes` requires `dishes:create`, same-origin/CSRF protection, and returns 201.
- `PATCH /api/dishes/manage/{dishId}` requires `dishes:update` and mutation protection.
- `POST /api/dishes/manage/{dishId}/archive` requires `dishes:update`.
- `POST /api/dishes/manage/{dishId}/restore` requires `dishes:delete`.

Handlers perform transport validation before invoking `createDishServices()`. The service independently
checks permissions and remains the only CRUD boundary, preserving defense in depth, audit records,
slug/reference rules, optimistic conflicts, and targeted Dish/SEO cache-tag invalidation.

Reference inspection consumes public Media, Category, Ingredient, and Dish APIs. Media must be a
ready image/video; referenced catalog entities must exist and not be archived. Blog persistence is not
implemented yet, so non-empty related Blog IDs fail closed as missing references. SEO persistence is
introduced by SK-0193; until then the SEO adapter deliberately leaves `seoPageId` unset rather than
inventing a dangling reference. Connecting those later adapters does not change the route contracts.
