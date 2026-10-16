# Public blog detail (SK-0172)

`/blog/[blogSlug]` loads only a currently published, non-deleted article whose `publishedAt` is not in the future. Unknown, draft, scheduled, archived, and future-dated slugs return not found before any article content is rendered. The page uses the browser-selected locale and the established translation fallback.

The story is read from the versioned rich-text document, sanitized again at the read boundary, and rendered as React nodes. Raw HTML is never inserted. Embedded image/video IDs resolve only through Media, with kind and processing checks; broken media is omitted. Related Blog and Dish references are individually rechecked for public visibility/availability before rendering, so archival or scheduling after the relation was saved cannot leak private content.

The canonical share URL is the validated SEO override when present, otherwise the configured site origin plus article path. WhatsApp, Telegram, Facebook, and LinkedIn links encode this exact URL and open with `noopener noreferrer`; copy-link uses the same URL. The view tracker waits for three seconds of visible engagement, submits one best-effort signal to the existing `/api/blogs/[blogSlug]/view` endpoint, and never blocks rendering. Server-side rate limiting and hash-based deduplication remain authoritative.

The page includes localized breadcrumbs, metadata, Article/Breadcrumb structured data, a responsive banner/body layout, and related content. Component tests cover safe rich text, all launch locales, and delayed view tracking; unit tests cover share URL encoding.
