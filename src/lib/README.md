# Library code

Framework-agnostic shared utilities and infrastructure adapters belong here.

- Utilities must be small, typed, and free of hidden global state.
- Browser-safe and server-only helpers must be separated clearly; server-only implementations use the `server-only` guard where appropriate.
- Domain business rules belong in `src/server/modules`, not in miscellaneous utility files.
- External-service clients expose project-owned interfaces and must not leak provider-specific payloads throughout the application.
- Every helper needs a concrete consumer or test; avoid generic “utils” collections.

Prefer named files and named exports over a large catch-all barrel.
