# Admins

Owns administrator profiles, normalized identifiers, password hashes, roles/permission assignments, activation state, and administrator CRUD invariants. It has no domain-module dependency; callers provide actor context and audit behavior through application orchestration.

SK-0047 defines fixed role grants in `src/constants/admin-access.ts` and exports `requireAdminPermission` from this module's public API. See `docs/permission-matrix.md`. Call it only with an actor resolved from a verified admin session; client-provided role claims are not authoritative. The Admin model and session resolution are subsequent tasks.
