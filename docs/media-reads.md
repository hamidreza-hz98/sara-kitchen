# Media reads and search

Both media read endpoints require an active admin session with `media:read`. They return the shared
no-store API envelope and never expose MinIO bucket names, object keys, checksums, deleted records, or
raw provider failures.

## List

`GET /api/media` supports:

| Parameter          | Contract                                                                    |
| ------------------ | --------------------------------------------------------------------------- |
| `page`, `pageSize` | Page starts at 1; size is 1–100; the result window cannot exceed 10,000.    |
| `search`           | 2–80 characters; indexed across original filename and every translated alt. |
| `kind`             | `image`, `video`, `pdf`, or `other`.                                        |
| `mimeType`         | Exact normalized MIME type, such as `image/webp`.                           |
| `uploaderId`       | Exact 24-character Admin ObjectId.                                          |
| `createdFrom/To`   | Inclusive ISO date/time boundaries.                                         |
| `usage`            | `used` (`usageCount > 0`) or `unused` (`usageCount = 0`).                   |
| `processingState`  | `pending`, `processing`, `ready`, or `failed`.                              |
| `sortBy`           | `createdAt`, `originalName`, `bytes`, or `usageCount`.                      |
| `sortDirection`    | `asc` or `desc`; `_id` is the stable tie-breaker.                           |

Every item includes safe metadata, translations, uploader ID, usage count, timestamps, and a preview.
Ready managed images use their smallest ready variant as preview; other ready managed items use the
original. Pending and failed items have no access URL. External items retain their validated HTTPS URL.

## Detail

`GET /api/media/:mediaId` returns the same safe metadata plus source, duration/page/failure metadata,
original access, and derived variants. Invalid IDs return `400`; absent or soft-deleted records return
`404`. A failed derived variant contains metadata but no URL.

## Private access

Managed object URLs are signed for exactly 300 seconds and each response includes `expiresAt`. Signing
is bounded to five concurrent operations per page/detail request. MinIO unavailability produces the
shared `503` dependency response rather than leaking its endpoint or SDK error. URLs are generated only
after authorization and are never cached by the API.

## Index strategy

Declared indexes cover default/date order, state plus kind, exact MIME type, uploader, used/unused, and
weighted text search over `originalName` and `translations.alt`. The state/kind/recent integration test
uses MongoDB `explain()` and asserts an `IXSCAN` through `media_list_state_kind_recent`; the combined
repository integration test proves every supported filter composes correctly. Production must provision
declared indexes before enabling the dashboard media list.
