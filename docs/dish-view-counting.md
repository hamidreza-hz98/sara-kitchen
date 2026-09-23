# Dish view counting (SK-0096)

Dish views are approximate privacy-conscious analytics, not transactional or billing data. A failed
count never changes whether a detail page renders, and a counter must never be awaited in the page's
critical response path.

## Meaningful-view policy

The detail experience emits a view signal only after at least 3,000 milliseconds of visible-page
engagement. `evaluateDishViewSignal()` independently enforces that duration and requires:

- a valid Dish ObjectId;
- a non-empty user agent no longer than 512 characters;
- visible document state and a safe integer engagement duration;
- no prefetch, prerender, or preview purpose; and
- no basic bot, crawler, link-preview, synthetic-monitor, headless, CLI, or API-client signature.

This is intentionally basic suppression rather than fraud detection. The policy removes obvious
non-human traffic and accidental preloads without pretending that user-agent detection can identify
every automated client. Future analytics requiring stronger guarantees need a consent/privacy review
and a specialized provider.

## Duplicate and privacy policy

One browser/network fingerprint may increment one dish once per six-hour UTC window. Refreshing or
reopening the same detail view during that window returns `duplicate`; a later window may count again.
This bounds straightforward refresh spam to at most four counts per day per fingerprint/dish.

The fingerprint is HMAC-SHA256 over a domain/version marker, the window, trusted client address, and
normalized user agent. It uses at least 32 bytes of server-only secret material. Raw addresses and
user agents never enter the receipt, logs, return value, or Dish document. If the deployment proxy
does not provide a valid address, `unknown` is used, deliberately undercounting identical user agents
rather than accepting spoofable source headers and inflating traffic. The production proxy must
overwrite `X-Forwarded-For`, consistent with authentication throttling.

Receipts have a unique `(dishId, visitorHash, windowStartedAt)` index and expire after 48 hours through
a TTL index. Enforcement relies on the unique index, never on timely TTL deletion. Secret rotation
changes future fingerprints and may permit one extra count in the active window; that is an accepted
analytics tradeoff and avoids retaining a separate tracking secret.

## Best-effort persistence

`createDishViewCounter()` validates synchronously and hands work to an injected post-response
scheduler. A Next.js adapter must pass `after(work)`; tests can capture the callback. The queue method
returns immediately and never performs database I/O itself. Scheduled failures are caught and emitted
through the structured logger without raw identity data, so they cannot reject the page response.

Persistence first claims the unique receipt, then atomically increments `viewCount` only when the Dish
is published, non-deleted, and below `Number.MAX_SAFE_INTEGER`. Duplicate claims stop before the Dish
write. A missing/draft/archived dish releases the claim. If incrementing throws, cleanup is attempted
and the original failure is rethrown only inside the already-isolated scheduled callback, allowing a
later signal to retry. This two-document best-effort process deliberately avoids a transaction because
view analytics do not justify latency or replica-set coupling.

The future dish-detail integration must send the engagement signal to its same-origin endpoint and
construct the counter with the existing server session secret, a request-scoped structured logger,
the Dish view repository, and Next.js `after`. It must not call or await the repository during Server
Component rendering.
