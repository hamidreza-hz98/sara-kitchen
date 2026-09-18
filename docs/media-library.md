# Media library page

The protected `/[locale]/dashboard/media` page is the dashboard media-management surface. It uses the
existing `GET /api/media` list contract and `PATCH`/`DELETE /api/media/:mediaId` mutation contracts;
it does not access MongoDB or object storage from the browser.

## URL state

The page preserves its list state in the query string so refreshes, deep links, browser navigation, and
shared admin links reproduce the same view:

| Parameter           | Values                                               |
| ------------------- | ---------------------------------------------------- |
| `view`              | `grid`, `list`                                       |
| `page` / `pageSize` | positive page; `12`, `24`, or `48`                   |
| `search`            | normalized search text, at least two characters      |
| `kind`              | `image`, `video`, `pdf`                              |
| `usage`             | `used`, `unused`                                     |
| `processingState`   | `pending`, `processing`, `ready`, `failed`           |
| `sort`              | date, name, bytes, or reference count with direction |

UI-only state (`view`) is intentionally removed before the API request. Filter and sort changes reset
the page to one; search is debounced and can also be committed with Enter. Unsupported or malformed
values fall back to bounded defaults in `src/lib/media-list-query.ts`.

## Interaction and safety

- Grid cards and list rows provide keyboard-reachable preview, metadata edit, selection, and delete controls.
- Reference counts are visible in both views. Referenced media has its delete action disabled in the UI;
  the API remains the authoritative guard for races and unauthorized clients.
- Edit submits only the safe filename and translated alt-text fields. Delete uses the CSRF-protected
  recycle-bin mutation and confirms one or many unreferenced items before submitting.
- Signed previews are rendered only from API-provided URLs. Images, videos, PDFs, processing states,
  empty results, loading, and recoverable errors have distinct accessible states.
- Controls stack at small widths, the grid expands from one to four columns, and the list view remains
  horizontally scrollable without clipping the dashboard shell.

The interaction contract is covered by `tests/component/media-library.test.tsx` and URL behavior by
`tests/unit/media-list-query.test.ts`.
