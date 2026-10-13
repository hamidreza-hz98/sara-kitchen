# Cart recommendations

SK-0142 adds optional, deterministic merchandising to the cart without building a behavioral profile.
The only input is the ordered set of dish IDs already in the current cart. The service does not consume
customer identity, sessions, views, purchases, searches, addresses, or tracking identifiers, and it does
not persist recommendation impressions or decisions.

## Ranking and explanation

Candidates are ranked in three explicit tiers:

1. published, currently orderable dishes explicitly related by a current cart dish;
2. published, currently orderable dishes sharing one or more categories with current cart dishes;
3. published, currently orderable featured dishes as deterministic fallback.

The current cart dishes, drafts, archived/deleted records, unavailable items, and candidates outside an
active schedule are excluded in the database query. A candidate present in several pools appears once at
its strongest tier. Related order follows cart-line and authored relation order. Category candidates then
prefer more shared categories and more matching source dishes. Featured order and immutable dish ID are
stable final tie-breakers.

Every result includes a machine-readable `reason`: `related` identifies its source dishes, `category`
identifies source dishes and shared category IDs, and `featured` is explicit. UI copy localizes these
reason codes; the backend never emits hard-coded explanatory prose.

## Bounds, localization, and failure isolation

The default response is six and the hard maximum is twelve. At most 50 unique current dish IDs are
accepted. Each candidate pool is limited to three times the requested result count, MongoDB operations
carry a 250 ms execution ceiling, and only public card fields are projected. Prices and availability are
evaluated at one shared instant.

Names and excerpts use the requested launch locale with configured/canonical fallback, including RTL
metadata. Raw translation arrays and ingredient source data are never returned. A malformed candidate is
omitted rather than corrupting the complete recommendation shelf.

Recommendations are loaded separately from cart CRUD. The cart-facing loader has a 400 ms total budget
and fails open to an empty `degraded` result on timeout or dependency failure. Cart reads, mutations,
totals, and rendering never depend on recommendation success. The storefront should render the cart
first and stream or request this shelf as optional enrichment.

## Verification

Unit coverage proves tier order, explanation evidence, de-duplication, caps, stable ordering, locale/RTL
fallback, malformed-candidate isolation, empty-cart behavior, input bounds, dependency failure, and timeout
behavior. A real MongoDB integration test proves current, unavailable, and unpublished dishes never enter
related, category, or featured pools.
