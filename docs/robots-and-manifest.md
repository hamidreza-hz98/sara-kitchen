# Robots and web manifest

## Crawler policy

`/robots.txt` is generated through the Next.js metadata route. Production allows public content while
disallowing API, dashboard, authentication, account, cart/checkout/payment-result, and developer showcase
paths. It advertises the canonical `/sitemap.xml` URL and canonical origin from `NEXT_PUBLIC_SITE_URL`.

Preview, test, and development environments use a fail-closed policy: `User-agent: *` plus `Disallow: /`,
without `Sitemap` or `Host` directives. Deployment code must set `NODE_ENV=production` only for the real
indexable production deployment. Page-level `noindex` metadata remains defense in depth; `robots.txt` is not
an authorization mechanism.

## Localized manifest

`/manifest.webmanifest` uses the persisted `SARA_LOCALE` browser cookie established by SK-0002. Missing or
invalid cookie values resolve to English; browser `Accept-Language` does not silently change the selected
language. The manifest provides localized name and description for English, Portuguese, and Persian, and
sets Persian to RTL.

The manifest uses the stable root URL as its identity, start URL, and scope because public locale prefixes do
not exist. It provides standalone/minimal UI display hints, the approved coral theme and light canvas colors,
and PNG icons with normal and maskable coverage. The locale layout links the manifest and declares matching
light/dark browser theme colors plus the Apple touch icon.

Manifest shortcuts are intentionally omitted until their storefront destinations are implemented as real
public pages. This prevents installed clients from exposing shortcuts that currently resolve to not-found.

## Verification

Unit tests lock production/non-production crawler behavior, canonical sitemap resolution, all localized
manifest variants, direction, colors, and icon coverage. Playwright verifies the live development policy,
cookie-selected Persian manifest, MIME types, and every referenced icon.
