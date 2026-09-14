# ADR-0003 — Embed typed translation arrays in content aggregates

- Status: Accepted
- Date: 2026-09-14
- Owners: Sara Kitchen engineering

## Context

Sara Kitchen launches in English, Portuguese, and Farsi. English is the default language, Farsi is
right-to-left, and the selected locale is stored in the browser without a `/:locale` URL prefix.
Categories, dishes, ingredients, blogs, settings, SEO, and other authored entities contain translated
fields while sharing identity, media, status, prices, relations, analytics, and timestamps.

Translations need atomic editing with their owner, predictable validation, efficient page reads, and
an explicit publication completeness rule. The schema must avoid scattering `nameEn`, `namePt`, and
`nameFa` fields across every model or relying on arbitrary untyped dictionaries.

## Decision

Store translatable content as a typed `translations` subdocument array inside the aggregate that owns
the content.

```ts
type SupportedLocale = "en" | "pt" | "fa";

type DishTranslation = {
  locale: SupportedLocale;
  name: string;
  excerpt: string;
  description: RichTextDocument;
};
```

- Locale-independent data stays at the aggregate root: identifiers, media references, price,
  discount, availability, lead time, relations, counters, status, and audit timestamps.
- Translation schemas are entity-specific and typed. Do not store arbitrary key/value bags or copy
  fields that are not actually linguistic.
- Each array contains at most one entry per locale. Zod/service validation enforces uniqueness because
  a MongoDB multikey unique index cannot express uniqueness within a single document's array.
- English (`en`) is always required and is the authoring fallback. Drafts may omit Portuguese or Farsi
  while content is being entered; publication requires non-empty entries for every language enabled
  in Settings.
- A requested missing translation falls back to English only for preview/administration. Publicly
  published content must already satisfy completeness, so fallback is an exceptional resilience path.
- Slugs derive from the normalized English title/name at creation, are stored separately, and remain
  stable unless an administrator explicitly changes them through a redirect-aware workflow.
- Locale resolution order is an explicit browser cookie, then English. Client-side storage may mirror
  the preference for UI convenience, but the cookie is authoritative so Server Components can render
  the correct language on the first response.
- URLs contain no locale segment. Canonical and alternate metadata must reflect the single URL model;
  localized content is selected by request state rather than separate localized paths.
- Rich text remains structured validated JSON in each translation, not pre-rendered HTML.

## Alternatives considered

### One field per language (`nameEn`, `namePt`, `nameFa`)

Rejected because every added locale requires broad schema/code changes and creates repetitive,
error-prone models.

### A separate translations collection

Rejected for MVP because it adds joins/queries, cross-collection consistency, and lifecycle cleanup for
content that is bounded and normally read with its owner.

### A locale-keyed arbitrary object or MongoDB map

Rejected because entity fields become weakly typed, locale validation is less explicit, and partial
updates can silently create inconsistent shapes.

### Locale-prefixed URLs

Rejected because the product owner explicitly requires language preference in the browser without a
`/:locale` slug. This choice sacrifices independently indexable localized URLs.

## Consequences

### Positive

- One query returns the entity and all bounded translations for editing or response selection.
- Content and translations update atomically and share lifecycle/permissions.
- Typed, entity-specific entries support strong validation and predictable forms.
- Adding a supported locale does not require new fields on every document.

### Costs and risks

- Documents are larger, although three text locales remain bounded for this product.
- Array uniqueness and publication completeness require application validation.
- Updating one translation rewrites part of the owning document and can create edit contention.
- One canonical URL means search engines cannot independently address locale-prefixed pages.
- Locale cookies affect caching and require the correct `Vary`/cache strategy for rendered responses.

## Revisit when

- The enabled locale count or translated payload size approaches MongoDB document/read limits.
- Translators require independent workflows, permissions, or version histories per locale.
- SEO evidence justifies locale-specific URLs and hreflang pages.
- Translation search requires a separately indexed localization store.

## References

- [Environment and launch locale contract](../environment.md)
- [next-intl documentation](https://next-intl.dev/)
