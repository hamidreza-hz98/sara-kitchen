# Content cache and revalidation (SK-0045)

The shared policy lives in `src/server/cache`. Only public, actor-independent content may use these tags. Carts, sessions, customer profiles, orders, payments, draft previews, and privileged dashboard data remain uncached unless a separate per-principal policy is approved.

## Tags

All tags use the versioned `sk:v1:` namespace. Each area—`settings`, `categories`, `dishes`, `blogs`, `seo`—has a `:list` tag and `:item:<immutable-id>` tags. Cached list/aggregate reads attach their area list tag. Cached detail reads attach their item tag. SEO detail reads additionally attach `sk:v1:seo:list`, because content mutations can change derived metadata for any page. A read that embeds data from another area also attaches that area’s list tag: for example a dish card showing category text attaches `categories:list`, and a homepage showing featured dishes and blogs attaches both `dishes:list` and `blogs:list`.

`tagsForContentRead()` and `contentFetchCacheOptions()` construct these tags without accepting arbitrary cache namespaces. Cacheable server `fetch()` calls use the latter, with a 60-second revalidation backstop. When direct MongoDB reads are placed inside Next.js `use cache` scopes in later module tasks, they must call `cacheTag(...tagsForContentRead(...))` and set a comparable finite `cacheLife`; enabling Cache Components is a separate integration change, not a side effect of this policy task. No customer- or admin-specific data enters shared cache scopes.

## Mutation mapping

| Committed change | Expired tags                                             |
| ---------------- | -------------------------------------------------------- |
| Settings section | `settings:list`, changed `settings:item`, `seo:list`     |
| Category         | `categories:list`, changed `categories:item`, `seo:list` |
| Dish             | `dishes:list`, changed `dishes:item`, `seo:list`         |
| Blog             | `blogs:list`, changed `blogs:item`, `seo:list`           |
| SEO page         | `seo:list`, changed `seo:item`                           |

Pass every changed immutable ID to `tagsForContentChange()`. If a lookup key or slug changes and caches are keyed by it, pass both old and new keys; prefer stable database IDs for item tags. The list tag covers new items, deletion, sort/featured changes, and aggregate views. Dependencies are expressed on the **read** by attaching multiple source tags, not by clearing every possible consumer domain. A global layout/path purge is prohibited for ordinary content edits.

## Consistency and timing

After a successful durable mutation (and after transaction commit), Route Handlers and jobs call `revalidateContentFromRoute()`, which uses Next.js `revalidateTag(tag, {expire: 0})`. The next server request for an affected tag waits for fresh data. Server Actions call `revalidateContentFromAction()`, which uses `updateTag()` for immediate read-your-writes. `updateTag()` must never be called from a Route Handler. A browser using a Route Handler must call `router.refresh()` after the successful response when it needs to replace an already-cached client route immediately. Otherwise the client router may continue to show its existing route cache until navigation/refresh. Do not claim that server tag invalidation pushes changes into already-open browsers.

The normal visibility target is **the first server render after successful invalidation**; on a tab performing a mutation, refresh the route after success. A cacheable fetch also has a 60-second time-based revalidation backstop, but that is not a hard freshness SLA under network failure. If post-commit invalidation fails, do not retry the database mutation merely to revalidate; log and retry invalidation from durable work/reconciliation. The future mutation modules must wire their save/delete/publish handlers to this adapter. At this foundation stage, no content CRUD handlers or cached MongoDB readers exist, so the tests prove the policy and Next.js calls with a tagged-cache simulation rather than claiming an end-to-end storefront freshness measurement.

Avoid caching personalized responses or any full HTTP response containing authorization context. Validate cache tags, immutable IDs, and data projections before publishing content. Include locale in the cache function/fetch key where localized output differs; the tags can remain shared so one edit invalidates all language variants.

## Verification

Unit tests cover all areas, detail/list/dependency tags, mutation mappings, unrelated-entry preservation, and the production adapters’ immediate-expiry versus Server Action calls. When content repositories and pages are implemented, add an end-to-end test that edits a dish, refreshes menu/detail/SEO, and confirms an unrelated blog cache entry remains hot.

Sources: [Next.js `revalidateTag`](https://nextjs.org/docs/app/api-reference/functions/revalidateTag), [`updateTag`](https://nextjs.org/docs/app/api-reference/functions/updateTag), [`use cache`](https://nextjs.org/docs/app/api-reference/directives/use-cache), and [cache handlers](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheHandlers).
