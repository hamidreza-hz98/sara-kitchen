# Slug generation and uniqueness (SK-0039)

Categories, dishes, blogs, and other addressable content store one locale-independent `slug` at the
aggregate root. The slug is created from canonical English content, remains stable when translated
content changes, and changes only through a deliberate administrator workflow.

## Normalization

`normalizeSlug()` produces a lowercase ASCII segment:

- apply Unicode compatibility decomposition and lowercase;
- remove combining marks so Portuguese/Latin accents normalize predictably;
- transliterate common non-decomposing Latin letters such as `æ`, `œ`, `ø`, and `ß`;
- convert Arabic and Persian digits to ASCII digits;
- remove apostrophes within words;
- turn other punctuation and whitespace into one hyphen;
- trim edge hyphens and cap the result at 96 characters by default.

Canonical English content is required by the translation model. A source containing no Latin letter
or digit is rejected rather than producing an empty or opaque URL. Slugs are not regenerated when an
English name/title changes.

## Creation and override workflow

```ts
const resolution = await resolveUniqueSlug({
  canonicalText: englishTranslation.name,
  currentSlug: dish.slug,
  adminOverride: command.slugOverride,
  isSlugTaken: (slug) => dishRepository.slugExists(slug, { excludeId: dish.id }),
  reservedSlugs: dishReservedChildren,
});
```

- On creation, omit `currentSlug`; canonical English generates the base.
- On an ordinary update, pass `currentSlug` and omit `adminOverride`; the existing URL is returned
  without a database lookup even if the English text changed.
- To change a URL, the admin command must explicitly provide `adminOverride`. It is normalized and
  checked exactly like a generated slug. Empty overrides fail validation.
- An override equal to the current slug is a no-op. A changed slug must create a permanent redirect
  record from the previous URL in the owning module's redirect-aware transaction; redirect storage is
  implemented with the addressable entity modules rather than hidden in this helper.

## Reserved paths and deterministic collisions

Application routes such as `menu`, `blog`, `dashboard`, `authentication`, `api`, and management path
words are reserved. A module may supply additional child routes. Reserved candidates are treated as
occupied; the resolver checks the base, then the lowest numeric suffix: `name`, `name-2`, `name-3`,
and so on. The base is shortened as needed so a suffix never exceeds the configured maximum length.

The bounded resolver returns `slug_candidates_exhausted` rather than looping forever. It reports
whether the result came from generation, an admin override, or an unchanged existing slug plus the
numeric suffix selected, allowing admin forms and logs to show URL adjustments.

## Database and concurrency contract

Every owning schema uses `createSlugField()` to create a required, normalized, collection-scoped
unique index. The async existence check gives friendly deterministic results but is not a lock: two
requests can choose the same candidate concurrently. The unique MongoDB index is the final guard.

Repositories must recognize duplicate-key error `11000`, rerun resolution against fresh state, and
retry the bounded create/update operation. Never drop uniqueness, reuse a soft-deleted entity's slug,
or expose raw database errors. Index creation/synchronization belongs in `pnpm indexes` and deployment,
not request handling.
