# Slug infrastructure

Import the server-only public API from `@/server/slugs`. Domain modules provide their own
collection-scoped existence check and keep models private.

- `normalizeSlug()` produces lowercase ASCII URL segments from canonical English text or an explicit
  admin override.
- `resolveUniqueSlug()` keeps existing slugs stable and selects deterministic numeric suffixes around
  reserved routes and existing documents.
- `createSlugField()` defines the required unique root field and final database concurrency guard.

See `docs/slugs.md` for creation, override, redirect, index, and race-handling rules.
