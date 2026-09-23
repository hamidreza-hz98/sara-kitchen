# Dish CRUD service contract (SK-0094)

The Dish service is the only supported mutation boundary for dish catalog records. Route handlers,
Server Actions, seeds, and jobs call the public `createDishServices()` API; they do not import the
Dish model. The service accepts request-scoped ports for dependency inspection, generated SEO,
append-only audit logging, and cache invalidation so cross-module persistence remains private.

## Lifecycle

- Create accepts `draft` or `published`; direct creation as `archived` is rejected.
- Read supports bounded administrative list and detail access after `dishes:read` authorization.
- Update preserves the existing slug unless an administrator supplies `slugOverride`. Direct status
  changes to `archived` are rejected so archive cleanup cannot be bypassed.
- Archive changes status to `archived`, removes featured placement, synchronizes generated SEO, and
  removes every inbound `relatedDishIds` edge. Affected dish cache tags are invalidated too.
- Restore is allowed only from `archived`, returns the dish to `draft` for deliberate review, and
  revalidates every dependency and relationship before persistence.

Creation, update, archive, and restore synchronize the SEO record after the primary write. The SEO ID
is linked through the repository when it changes. Durable mutations invalidate the dish list, dish
ID, relevant slug, generated SEO list, and any dishes changed by relationship cleanup. Every allowed,
failed, or denied action emits a canonical English audit event through the Logs module adapter.

## References and relationships

The service sends one reference set to an injected catalog inspector for Media, Categories,
Ingredients, Dishes, and Blogs. The adapter uses those modules' public APIs and returns typed missing
or archived issues. Either state blocks create/update/restore; issue metadata contains only the entity
kind and ID and is safe for field mapping.

Dish relations are directed and must form an acyclic graph. A dish cannot relate to itself. Before an
update or restore, the repository traverses active outbound edges from the proposed related dishes;
if any path reaches the edited dish, the mutation fails with `circular_relationship`. The traversal
fails closed after 10,000 visited nodes. Archiving removes inbound edges so active catalog records do
not retain broken recommendations.

## Publication and concurrency

Drafts still require structurally valid references when a reference is present. Published dishes
additionally require all configured locales, at least one ready media item, one active category, and
one active ingredient. The dependency adapter is responsible for classifying non-ready media as
unavailable at this boundary.

Slugs use the shared English canonical-name policy and deterministic collision suffixes. Creation
retries a racing unique-index conflict up to three times. Updates use Mongoose optimistic versioning;
duplicate-key and stale-version writes become the stable `conflict` service error.

Service errors use stable codes for forbidden, invalid input, missing/archived references,
self/circular relations, conflicts, missing records, and invalid restore state. Raw database errors,
documents, and cross-module models are not exposed.
