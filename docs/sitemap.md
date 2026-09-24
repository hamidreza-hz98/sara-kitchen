# Sitemap generation

## Public sources

`/sitemap.xml` combines narrow read-only projections owned by each domain module:

- implemented public static routes (currently the homepage);
- published, non-deleted categories;
- published, non-deleted dishes that are currently available, including active scheduled windows;
- published, non-deleted blogs whose publication time is not in the future.

Draft, scheduled blog, archived, unavailable, future-window, expired-window, soft-deleted, authentication,
profile, dashboard, cart, checkout, payment-result, and API routes never enter the source set. Category,
Dish, and Blog keep model access private; SEO consumes their public sitemap projections only.

The other approved static SEO routes are intentionally withheld until their canonical storefront pages are
implemented. This avoids advertising a URL that currently returns not-found. Category, dish, and blog paths
have guarded canonical server pages: each checks current domain visibility and active SEO before rendering,
so direct access cannot expose private records.

## Locale and URL policy

SK-0002 established a single clean public URL per page and browser-stored locale selection. Each sitemap URL
therefore has BCP 47 `xhtml:link` alternates for the translations actually stored on that entity plus
`x-default`, all pointing to the same canonical URL. No fictional `/en`, `/pt-PT`, or `/fa` URL is emitted.
If independent localized search indexing is required later, locale routing must first provide distinct,
successful canonical URLs.

Every entry includes the entity's real `updatedAt` as ISO `lastmod`. The checked-in homepage content date is
used until a persistent static SEO/content record owns its publication timestamp. URLs are deduplicated and
sorted deterministically.

## Protocol and scaling

The XML serializer escapes all text and declares both Sitemap and XHTML namespaces. `/sitemap.xml` serves a
normal URL set through 45,000 entries. Above that conservative threshold it becomes a sitemap index pointing
to `/sitemaps/{zero-based-page}.xml`; each shard stays below the protocol's 50,000-URL ceiling. Invalid or
out-of-range shard requests return 404.

Responses use `application/xml`, `nosniff`, and five-minute shared caching with stale-while-revalidate. If a
dynamic dependency is temporarily unavailable, generation emits an operational error and returns the verified
static set instead of failing the sitemap endpoint or publishing uncertain entity URLs.

The route-contract checker recognizes only explicitly marked XML sitemap handlers and requires every exported
method to pass through `sitemapXmlResponse`. JSON API handlers remain subject to the normal shared API envelope.

## Verification

Unit fixtures cover canonical URLs, locale alternates, `lastmod`, XML output, deduplication, validation, and
multi-shard boundaries. MongoDB integration fixtures prove every status/deletion/time-window exclusion and
the matching route visibility guards. The Playwright acceptance test loads `/sitemap.xml`, rejects private
paths, visits every emitted URL, requires HTTP 200, and verifies its rendered canonical link.
