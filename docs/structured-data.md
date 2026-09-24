# Structured data

## Policy

Structured data is emitted as one validated `https://schema.org` JSON-LD graph. `PageSeo.structuredData.types`
is an allow-list of candidate node types, not permission to invent claims. The generator omits a candidate
when its required source data is incomplete or invalid.

| Requested type       | Emitted schema      | Minimum truthful source data                                                       |
| -------------------- | ------------------- | ---------------------------------------------------------------------------------- |
| `organization`       | `Organization`      | Valid site URL and non-empty site name                                             |
| `local-business`     | `LocalBusiness`     | Organization data, complete postal address, telephone                              |
| `food-establishment` | `FoodEstablishment` | Local-business data; cuisine is included only when configured                      |
| `restaurant`         | `Restaurant`        | Local-business data and at least one configured cuisine                            |
| `product`            | `Product`           | Dish identity plus valid integer price cents, ISO currency, and known availability |
| `menu-item`          | `MenuItem`          | Same qualified dish data as Product                                                |
| `breadcrumb-list`    | `BreadcrumbList`    | Non-root canonical page with a localized title                                     |
| `article`            | `Article`           | Published blog, author display name, and valid publication timestamp               |
| `faq-page`           | `FAQPage`           | At least one complete localized question and answer; partial arrays are rejected   |

The existing `WebPage`, `WebSite`, and `Menu` candidates are also rendered when selected. Business
specialization is exclusive: the most specific requested and fully supported type is emitted, avoiding
duplicate nodes that describe the same business identity inconsistently.

## Inputs and provenance

- Localized names and descriptions come from the active SEO translation using the normal requested ->
  configured fallback -> English selection policy.
- Canonical page URLs come from the approved canonical override or the normalized SEO path plus the
  validated public site URL.
- Dish price is stored as integer cents and converted to a two-decimal string; availability maps only
  approved domain states to Schema.org URLs. Automatic SEO publishes Offer inputs only for stable,
  non-discounted and non-scheduled dishes. A future dish page must pass its request-time pricing result for
  scheduled discounts/availability; until then Product/MenuItem is omitted rather than becoming stale.
- Blog authors and publication/modification timestamps are synchronized from the Blog aggregate.
- Images use the same ready, localized Media projection as Next.js metadata.
- Organization/contact/address/social fields belong to the Settings adapter. Until that persistent
  projection is implemented, the storefront adapter exposes only the verified project name, site URL,
  and checked-in logo. It deliberately does not claim an address, phone number, opening hours, ratings,
  or restaurant type.

## Safety and rendering

Every generated graph is parsed through strict Zod schemas before rendering. URLs must be absolute HTTP(S),
dates must be ISO timestamps, currencies/country codes use bounded uppercase forms, breadcrumb positions
must be consecutive, and unknown properties are rejected. Invalid or incomplete candidate nodes are omitted;
if nothing truthful remains, no script is rendered.

`serializeStructuredData` escapes `<`, U+2028, and U+2029 before the server component writes JSON into an
`application/ld+json` script. User-managed text therefore cannot close the script element. The homepage is
the first representative integration and renders WebPage, WebSite, and Organization fallback data. Future
dish, blog, menu, and FAQ pages call the same storefront adapter with their normalized path.

## Verification

Fixture tests parse every supported launch type through the runtime graph validator, verify eligibility and
omission behavior, ensure money/availability/date mappings remain accurate, and cover script-breaking input.
The Playwright metadata test parses the homepage's rendered JSON-LD and asserts the localized WebPage plus
WebSite and Organization nodes.
