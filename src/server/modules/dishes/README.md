# Dishes

Owns dish translations, slug, catalog state, media/category/ingredient references, base price/discount source data, availability, lead time, relations, and dish counters. It may consume the public APIs of Media, Categories, and Ingredients. Orders and carts persist their own snapshots rather than reaching into the Dish model.

The Dish model implements the SK-0091 contract with English-canonical translated name, excerpt,
bounded rich-text description, and labelled specifications; a stable unique slug; ordered media and
category references; and ingredient links with optional paired amount/unit plus localized notes. One
base price in integer EUR cents applies to the configured portion amount/unit. Discounts are a
validated `none`, fixed-cents, or percentage-basis-points structure with an optional valid UTC window.

Content status is independent from immediate, unavailable, or bounded scheduled commerce
availability. Lead time is persisted in integer minutes up to seven days, per-order quantity is
bounded from 1–99, and vegan metadata canonicalizes to include vegetarian. The model stores only
explicit `mayContain` allergen warnings; definite allergens remain derived from linked Ingredients.
Featured ordering, related dish/blog references, SEO linkage, nonnegative sold/view counters, base
actor/timestamps, and soft deletion complete the aggregate.

Schema validation owns structural and local cross-field invariants. Publication readiness and the
existence/status/type of Media, Category, Ingredient, Blog, Dish, and SEO references remain service
concerns so this module does not import another module's persistence layer. Unique slug enforcement is
the database concurrency guard; the future CRUD service must use the shared collision-resolution
policy before writes.

Named indexes cover public/category/featured/price catalog reads, availability and discount windows,
localized text search, every reverse-reference path, dietary/allergen filters, and the unique slug.
Integration coverage proves MongoDB uniqueness plus index selection for the core public and category
queries.

`calculateDishPrice()` is the single unit-price resolver. It validates the persisted definition,
applies inclusive-start/exclusive-end discount schedules, performs percentage half-up rounding with a
non-overflowing integer intermediate, and returns numeric EUR values plus structured display metadata.
The model delegates price/discount invariants to the same validator. See
[`docs/dish-pricing.md`](../../../../docs/dish-pricing.md) for the public contract and consumer rules.

CRUD operations are exposed only through `createDishServices()` and documented in
[`docs/dish-crud.md`](../../../../docs/dish-crud.md). The service owns action permissions,
publication validation, collision-safe slugs, missing/archived reference rejection, acyclic
related-dish rules, SEO synchronization, append-only audit outcomes, and targeted cache invalidation.
Its repository is the only layer that accesses the Dish model. Cross-module dependency inspection is
injected through a public port, so this module never imports another aggregate's persistence internals.
Archive removes inbound related-dish edges; restore returns to draft after dependency validation.

Public menu lists use `createDishCatalogService()` rather than the administrative repository. It
applies published/non-deleted scope, localization fallback, active price and orderability resolution,
category/featured/discount/dietary/allergen filters, allow-listed indexed sorts, deterministic page
ties, and a fixed public projection. Allergen exclusions and derived `contains` tags come through the
Ingredients public allergen catalog. See
[`docs/dish-catalog-query.md`](../../../../docs/dish-catalog-query.md) for the query and performance
contract.
