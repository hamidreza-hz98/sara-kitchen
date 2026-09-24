# Next.js metadata generation

## Data flow

Public pages call `resolveStorefrontMetadata(path, locale, fallback)`. The adapter reads the one active
`PageSeo` projection for the normalized public path and converts it through `createNextMetadata`.
Category, Dish, and Blog values are not queried across module persistence boundaries: their synchronized
SEO aggregate from SK-0108 is the entity snapshot used for discovery metadata.

The site settings input owns the validated absolute site URL, application/site name, and icon roles. It
currently adapts the project constants and App Router favicon convention; persistent Settings can replace
that adapter later without changing page or SEO-domain code.

If MongoDB or object storage is temporarily unavailable, metadata generation emits an observable warning
and uses the page's localized catalog defaults. A metadata dependency failure therefore does not turn an
otherwise renderable storefront page into an error response.

## Mapping

- localized SEO title, description, and keywords become their standard metadata fields;
- a manual HTTPS canonical wins; otherwise the canonical is the normalized path resolved against
  `NEXT_PUBLIC_SITE_URL`;
- robots and Googlebot receive index/follow, archive, image, snippet, and preview directives;
- localized Open Graph and Twitter overrides fall back to localized title/description;
- site name and icons come from the settings input;
- ready share-image Media references resolve through Media's public API. Managed objects use a
  short-lived signed read URL because all MinIO buckets are private; external images retain their approved
  HTTPS URL;
- Open Graph locale uses underscore syntax (`pt_PT`), while document/hreflang locales retain BCP 47
  (`pt-PT`).

The public URL intentionally has no locale segment. Consequently, all available language alternates point
to the same canonical URL and the locale remains selected by the browser cookie, as approved in SK-0002.
This truthfully exposes the language variants without inventing crawlable locale routes. If independent
language indexing becomes a launch requirement, the routing decision must be revisited because distinct
hreflang URLs are the interoperable search-engine model.

## Rendering and verification

The locale layout supplies the metadata base, application name, and icon defaults. The homepage supplies a
page-level generator, so stored SEO replaces localized defaults when present. Future menu, category, dish,
blog, About, Contact, FAQ, and Terms pages should call the same adapter with their normalized public path.

Unit tests cover every mapped field, Persian selection, English fallback, custom canonicals, settings, and
social images. MongoDB integration coverage proves only active SEO records reach the projection. Playwright
loads the real homepage and asserts the rendered title, description, canonical, hreflang, Open Graph,
Twitter, and icon elements in `<head>`.
