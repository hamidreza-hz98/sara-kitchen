# Blogs

Owns translated article content, slug, media references, author snapshot/reference, publishing state/schedule, relations, and views. It may consume Media, Admins, and Dishes through public APIs. Rich content is sanitized at its trust boundary.

## Model decisions

- Lifecycle states are `draft`, `scheduled`, `published`, and `archived`. A scheduled record owns `publishAt`; `publishedAt` records the first publication and is retained through unpublish, re-schedule, and archive. Repository writes permit only the initial timestamp assignment.
- Rich content uses the versioned ProseMirror-compatible JSON envelope and strict allow-list documented in `docs/rich-text-policy.md`; raw HTML is never stored or rendered.
- MVP taxonomy uses normalized tag slugs. A separate blog-category aggregate is deferred rather than reusing food-menu categories and coupling two different taxonomies.
- `authorSnapshot.displayName` preserves historical attribution while `authorAdminId` supports current-author lookup. Services must capture both from the authenticated admin rather than trusting client input.
- Media, dish, blog, and SEO fields store references only. CRUD services validate existence, status, media kind, cycles, and permissions before persistence.

## Publishing boundary

- Public list/detail repository methods always add `deletedAt: null` and `status: published`; a guessed draft, scheduled, unpublished, or archived slug therefore returns not found.
- Preview is available either to a currently authorized administrator with `blogs:read`, or through a 15-minute HMAC token bound to the Blog ObjectId and optimistic version. Editing the article immediately invalidates an issued token. Preview responses are private/no-store and `noindex, nofollow`.
- Create and update cannot set lifecycle fields. Separate `blogs:publish` actions schedule, publish, and unpublish; `blogs:delete` archives and removes inbound Blog and Dish relationships through their public module ports. Scheduling/publishing requires all launch translations and valid, non-archived references.
- `publishScheduled()` is the server-only idempotent scheduler entry point. Its compare-and-update repository operation promotes due records once, performs SEO synchronization, writes a system audit event, and invalidates Blog/detail plus SEO cache tags. The deployment scheduler must invoke this entry point at least once per minute when cron infrastructure is configured.
- Public view signals require three seconds of visible engagement, reject common bots/prefetches, and persist only a keyed hash in a six-hour deduplication window. The best-effort post-response update can never delay or fail article rendering.
