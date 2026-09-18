# Categories

Owns category translations, slug, status, ordering, media references, and category CRUD invariants. It may consume Media’s public API to validate references. Dish membership/counts are obtained through public Dish queries or analytics orchestration, never by importing Dish persistence code.

The Category model stores required English name/description in `translations`, optional
Portuguese/Persian entries, a stable slug generated from the English name on first
validation, image-only media IDs, a status, sort order, optional SEO page ID, base
audit/timestamps, and soft-delete metadata. The unique slug index reserves slugs
even after soft deletion so old public links are never reassigned. Future create/update
services should use `resolveUniqueSlug()` for collision suffixes and deliberate admin
overrides, retry duplicate-key races, and call `validateCategoryMediaReferences()`
before persisting media IDs. That helper queries Media through its public API and
rejects missing, deleted, unready, or non-image assets without crossing model
boundaries. The `seoPageId` reference is an optional link; SEO record lifecycle is
owned by the SEO module.
