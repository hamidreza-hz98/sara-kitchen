# Blogs

Owns translated article content, slug, media references, author snapshot/reference, publishing state/schedule, relations, and views. It may consume Media, Admins, and Dishes through public APIs. Rich content is sanitized at its trust boundary.

## Model decisions

- Lifecycle states are `draft`, `scheduled`, `published`, and `archived`. A scheduled record owns `publishAt`; a published record owns immutable `publishedAt`; archived records retain publication history.
- Rich content currently accepts only a bounded ProseMirror-style document envelope. SK-0103 defines the final node, mark, link, and embed allow-list before rendering or authoring is enabled.
- MVP taxonomy uses normalized tag slugs. A separate blog-category aggregate is deferred rather than reusing food-menu categories and coupling two different taxonomies.
- `authorSnapshot.displayName` preserves historical attribution while `authorAdminId` supports current-author lookup. Services must capture both from the authenticated admin rather than trusting client input.
- Media, dish, blog, and SEO fields store references only. CRUD services validate existence, status, media kind, cycles, and permissions before persistence.
