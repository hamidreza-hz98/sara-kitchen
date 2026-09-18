# Library code

Framework-agnostic shared utilities and infrastructure adapters belong here.

- Utilities must be small, typed, and free of hidden global state.
- Browser-safe and server-only helpers must be separated clearly; server-only implementations use the `server-only` guard where appropriate.
- Domain business rules belong in `src/server/modules`, not in miscellaneous utility files.
- External-service clients expose project-owned interfaces and must not leak provider-specific payloads throughout the application.
- Every helper needs a concrete consumer or test; avoid generic “utils” collections.

Prefer named files and named exports over a large catch-all barrel.

`media-bulk-upload.ts` is the browser-side, bounded worker pool for the media upload page. It composes
independent atomic requests rather than moving multi-file orchestration into a Vercel Function. See
[`docs/media-bulk-upload.md`](../../docs/media-bulk-upload.md).
