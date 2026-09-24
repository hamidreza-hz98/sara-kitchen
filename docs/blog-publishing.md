# Blog publishing operations

## Lifecycle

`draft -> scheduled -> published -> draft` is the normal editorial path. An editor with
`blogs:publish` may also publish a complete draft immediately, cancel a schedule back to draft, or
re-schedule an unpublished article. Archive is a terminal content-visibility action; it removes
inbound Blog relations and requires `blogs:delete`.

`publishedAt` is the first successful publication timestamp. It is assigned once and retained for
historical attribution through unpublish, re-schedule, and archive. `publishAt` exists only while
the record is scheduled. Current public visibility is determined exclusively by `status ===
"published"` and `deletedAt === null`.

## Public and preview access

Public list and detail reads use dedicated repository methods that always enforce the public scope.
Unpublished slugs respond as not found and never fall back to a management read.

An authenticated administrator with `blogs:read` can preview directly. The management API can also
issue a 15-minute HMAC preview token for external review. It is bound to the Blog ObjectId and
record version, so edits invalidate it. Tokens are bearer credentials and must not be logged or
stored in analytics. Preview responses use `private, no-store` and `X-Robots-Tag: noindex,
nofollow`.

## Scheduling and consistency

The Blog service exposes `publishScheduled()` for a trusted deployment job. The job should run at
least once per minute. Promotion uses a status, due-time, and optimistic-version condition, making
concurrent invocations and retries idempotent. Each promoted article triggers SEO synchronization,
a system audit event, and targeted Blog/detail/SEO cache invalidation.

SEO persistence remains behind the `BlogSeoPort`; the concrete Page SEO implementation arrives in
SK-0107/SK-0108. Until then the adapter deliberately returns no identifier, while all lifecycle
operations still invoke the synchronization boundary and cannot silently bypass it later.

## View counting

The client submits an engagement signal only after at least three seconds of visible reading.
Common bots, prefetch/prerender traffic, hidden documents, invalid agents, and malformed signals are
ignored. The server creates an HMAC visitor fingerprint from the time window, validated client
address, and user agent; raw network and agent data are never persisted in view receipts. A unique
six-hour window prevents refresh inflation, receipts expire after 48 hours, and persistence runs
best-effort after the response.
