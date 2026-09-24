# Homepage settings

## Content contract

Homepage merchandising is a staged settings section. Array position is the authoritative display order;
clients cannot submit a separate, contradictory sort value. The locale-neutral `data` snapshot owns stable
identifiers, references, links, visibility, ratings, and selection order. The `translations` snapshot owns
visitor-facing copy for English, Portuguese, and Persian.

| Area              | Data and limits                                                                                      | Localized content                        |
| ----------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Hero/slider       | Up to 8 stable entries, desktop image, optional mobile image, public link, new-tab and enabled flags | Title, description, CTA label, image alt |
| Linked banners    | Up to 8 entries with image, public link, new-tab and enabled flags                                   | Optional title and required image alt    |
| Featured dishes   | Ordered, unique dish references; hard maximum of 6                                                   | Section title                            |
| Slogans/benefits  | Up to 12 stable entries with optional image icon and enabled flag                                    | Title and description                    |
| Testimonials      | Up to 12 stable entries with optional avatar, 1–5 rating, and enabled flag                           | Author, optional role, and quote         |
| Category banners  | Up to 12 unique category references with optional image override                                     | Optional title and required image alt    |
| Discounted dishes | Automatic or curated mode, enabled flag, display limit up to 12, and ordered curated references      | Section title                            |
| Blog selection    | Up to 12 ordered, unique blog references                                                             | Section title                            |

Automatic discount mode accepts no explicit dish IDs; the storefront query will select discounted dishes
up to the configured limit. Curated mode preserves the submitted dish order. Stable kebab-case IDs connect
locale-neutral hero, banner, benefit, and testimonial records to their localized copy without coupling
content order to language.

Canonical English must cover every configured item. Portuguese and Persian may be partial while editing so
the shared fallback policy can preview a draft, but they cannot contain unknown or duplicate item IDs.
Section headings are required in every submitted locale. Links are limited to public internal routes or
credential-free HTTPS URLs; dashboard and API routes are never valid merchandising destinations.

## Reference policy

`validateHomepageSettingsReferences` is the single cross-module reference gate and consumes only public
Media, Dish, Category, and Blog APIs. It checks all distinct references concurrently and reports every issue
in one deterministic error rather than failing after the first bad item.

- Draft save rejects missing/deleted/archived records, non-image media, and media that is not ready. It permits
  valid draft catalog/blog records so editors can prepare a coordinated release.
- Publish repeats the draft checks and additionally requires published dishes, categories, and blogs. Selected
  dishes cannot be explicitly unavailable. A future settings service must run this gate again immediately
  before changing the published revision; a previously valid draft is not publication authorization.
- All visual references must resolve to non-deleted, ready `image` media. Missing media and deleted media are
  intentionally indistinguishable at this boundary.
- Scheduled dish availability is allowed because the catalog already owns its time-window rules. Discount
  expiry does not invalidate settings; the runtime pricing/catalog policy determines whether a dish appears
  in an automatic or curated discounted block.

The draft/publish distinction avoids preventing coordinated content preparation while guaranteeing that no
archived, deleted, unready, unpublished, or unavailable item can enter the public homepage snapshot.

## Validation and persistence

`parseHomepageSettings` is the required codec before persistence. It rejects unknown properties, malformed
ObjectIds, duplicate references, excessive collections, invalid item identifiers, unsafe links, incomplete
canonical copy, and featured selections above six. The parsed data and translations fit the versioned
settings revision envelope introduced by SK-0115; staged revision history and selection order remain intact.

SK-0123 will add the generic authorized settings command service, audit events, optimistic revision writes,
publication orchestration, and cache invalidation. That service must invoke this codec on every homepage
write and the appropriate reference mode on both draft save and publish.

## Verification

- Unit coverage exercises all homepage areas, ordering, the six-dish cap, duplicates, canonical translation
  coverage, safe links, missing/archived references, publication state, media kind/readiness, and the valid path.
- MongoDB integration coverage stores a parsed staged revision and proves ordered selections survive the
  versioned settings envelope.
- The architecture boundary check proves Settings consumes only other modules' public APIs.
