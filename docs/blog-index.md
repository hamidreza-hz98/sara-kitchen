# Public blog index (SK-0171)

`/blog` renders a server-loaded list of published articles in the selected browser locale. The blog module's public repository is the only data source. Its query excludes deleted, draft, scheduled, archived, and future-dated records. The index uses the existing blog tag taxonomy only as article metadata; the approved launch controls are search and newest/oldest/most-viewed sorting. There is no separate blog-category aggregate.

The URL owns `q`, `sort`, `view`, and `page`. Default values, unknown parameters, repeated parameters, invalid search terms, and overly deep pages redirect to the canonical query string. Pagination is nine articles per page with stable `_id` tiebreak ordering. An out-of-range page returns to page one. The banner, breadcrumbs, featured cards, grid/list cards, empty state, and pagination are server-rendered; controls use ordinary links and a GET form so they work without JavaScript. Featured cards are the latest three articles on the unfiltered first page.

Article images resolve from the Media module and degrade to a branded gradient if an object is unavailable. The page reuses the static blog-index SEO record and web-page/breadcrumb structured data. Verify in all three launch languages and at mobile/tablet/desktop widths before publication. Article detail implementation is tracked separately by SK-0172.
