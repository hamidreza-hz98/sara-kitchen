# Media bulk upload

Bulk upload is a browser-side coordinator over the atomic `POST /api/media` endpoint. It deliberately
does not proxy many files through one Vercel Function: that would violate the approved 3.5 MiB request,
single-image processing slot, memory, and execution-duration limits.

## Contract

`uploadMediaBatch(items, options)` accepts 1–10 files. Every item has a caller-generated unique
`clientId`, one `File`, and localized alt text. The coordinator:

- fetches one current admin CSRF token unless the caller provides it;
- starts at most two requests concurrently by default, with an enforced maximum of three;
- reports `queued`, `uploading`, `retrying`, `succeeded`, and `failed` events per file;
- uses `XMLHttpRequest.upload` for byte-level browser progress;
- preserves input order in the final result even when requests complete out of order;
- never rejects the batch because an individual file failed;
- returns every terminal item plus totals for succeeded, failed, and retried files.

An invalid batch envelope—empty batch, more than ten files, duplicate client IDs, or an invalid
concurrency setting—fails before network work. File validation remains authoritative in the single-file
Route Handler, so mixed valid/invalid batches produce independent results.

## Retry policy

Network failures and HTTP 408, 425, 429, and 5xx responses are transient. They receive at most two
retries with 250 ms and 500 ms exponential delays; a bounded `Retry-After` header takes precedence.
Validation, authentication, authorization, conflict, and other permanent responses are not retried.
Each retry is safe because `POST /api/media` detects content duplicates and cleans partial objects before
returning a failure. Cancellation stops active XHR requests and marks work that has not started as failed.

## UI integration

The media upload page should use stable client IDs as row keys, consume `onProgress` events to update
individual rows, and render the returned summary after all workers settle. A failed row may be submitted
again on its own; successful rows must not be included automatically because checksum duplicate protection
will correctly reject them.
