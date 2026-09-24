# SEO

Owns static/entity SEO records, manual-versus-generated field state, canonical metadata, robots directives, social metadata, structured-data inputs, and sitemap projections. It may consume public APIs from Media, Categories, Dishes, and Blogs; it never imports their persistence models.

`PageSeo` is one locale-aware aggregate per entity or static-page target. Localized search and
social copy lives in its translation array; routing, canonical URL, robots policy, share media and
structured-data inputs remain language-neutral because storefront locale selection does not alter
the URL. Partial unique indexes allow history while guaranteeing one active record for a target and
one active owner of a normalized path. Structured-data inputs are bounded plain JSON and are inputs
to trusted renderers, never preassembled JSON-LD copied directly into a page.

Automatic entity synchronization is implemented by `createAutomaticSeoSynchronizer()`. Its granular
`manualOverrides` ownership map protects administrator edits while allowing unchanged generated fields
to follow later Category, Dish, and Blog updates. See
[`automatic-seo.md`](../../../../../docs/automatic-seo.md) for merge, retry, and compensating-rollback
rules.
