# Automatic entity SEO

Category, Dish, and Blog creation and mutation use the SEO module's single idempotent synchronizer.
The adapter derives an immutable entity target, normalized public route, localized search/social copy,
share image, canonical URL, Open Graph type, and safe structured-data inputs. Production canonical
URLs require HTTPS; local HTTP development deliberately stores no canonical URL.

## Ownership and merge rules

Generated fields remain automatic until an authorized SEO mutation marks the corresponding field in
`manualOverrides`. Root ownership is tracked for the route pair (path and slug), canonical URL, share
image, Open Graph type, and structured data. Translation ownership is tracked independently by locale
for title, description, keywords, and each Open Graph/Twitter title or description. Synchronization:

1. creates any missing locale from entity content;
2. refreshes only fields that are not marked manual;
3. preserves each marked value byte-for-byte through later entity updates;
4. updates lifecycle visibility even when authored metadata is manual; and
5. reuses the same SEO ObjectId across retries, archive, and restore.

The route is one ownership unit because its path and final slug must remain consistent. A manually
chosen canonical URL may intentionally differ from the page path (for duplicate-content consolidation)
but must still be credential-free HTTPS with no query or fragment.

## Creation consistency

The catalog service creates the entity, synchronizes SEO, then writes the SEO backlink before it
returns success. SEO synchronization is an idempotent target-key upsert with duplicate/version retry.
If synchronization or backlinking fails, the service runs two guarded compensations concurrently:

- soft-delete any partially created SEO record; and
- hard-delete the just-created entity only when its version is unchanged and `seoPageId` is still null.

The request fails loudly when either persistence step fails. The version guard deliberately refuses
to erase a concurrently modified entity; such an exceptional record is visible to operations and can
be repaired by rerunning synchronization. Updates fail before reporting success and can be safely
retried because the synchronizer is idempotent.

## Source mapping

| Entity   | Public path             | Search title/description | Share-image default | Schema defaults                  |
| -------- | ----------------------- | ------------------------ | ------------------- | -------------------------------- |
| Category | `/menu/category/{slug}` | name / description       | image, then banner  | WebPage, Menu, BreadcrumbList    |
| Dish     | `/menu/{slug}`          | name / excerpt           | first media         | WebPage, Product, BreadcrumbList |
| Blog     | `/blog/{slug}`          | title / excerpt          | image, then banner  | WebPage, Article, BreadcrumbList |

Generated values are constrained to the Page SEO model limits. Rich or markup-like source text is
reduced to bounded plain metadata. Structured-data values are trusted template inputs, not executable
or pre-rendered JSON-LD.
