# Admins

Owns administrator profiles, normalized identifiers, password hashes, roles/permission assignments, activation state, and administrator CRUD invariants. It has no domain-module dependency; callers provide actor context and audit behavior through application orchestration.

SK-0047 defines fixed role grants in `src/constants/admin-access.ts` and exports `requireAdminPermission` from this module's public API. See `docs/permission-matrix.md`. Call it only with an actor resolved from a verified admin session; client-provided role claims are not authoritative.

SK-0048 adds the private `admins` MongoDB model. It stores normalized first/last names, one normalized username-or-email identifier, the stable role code, an Argon2id password hash, password version, active flag, and shared base-schema timestamps/actor metadata. Effective permissions are derived from the role and never duplicated in storage. The identifier has a global unique index, including disabled accounts, so a disabled identity cannot be impersonated by a new record. The hash is excluded from ordinary queries and JSON serialization; only credential operations may explicitly select it. New hashes use Argon2id with 19 MiB memory, two iterations, and one parallel lane, following the [OWASP password-storage baseline](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). `passwordVersion` is reserved for session invalidation after password changes.

The model remains private to Admins. Repository and service consumers use the module's public API,
enforce action permissions, use active/non-deleted account filters for authentication, and increment
`passwordVersion` on password changes. Direct MongoDB update operators can bypass Mongoose document
validation, so they are not exposed as generic admin update APIs.

SK-0052 adds `lastLoginAt` and public, serializable admin-login identity helpers. Only an active admin can be resolved; the login workflow updates the timestamp after successful session issuance. No password hash or Mongoose document is exposed through the public module API.

SK-0125 adds paginated list/detail/create/update/disable/reactivate/credential-reset/soft-delete
management. Identifiers remain normalized and globally unique, including disabled/deleted records, so
old identities cannot be silently reused. Ordinary reads require `admins:read`; identifier disclosure
also requires `admins:read-sensitive`; role changes require `admins:assign-role`; and every lifecycle
action uses its explicit permission.

The final active owner cannot be demoted, disabled, or deleted. An administrator cannot disable or
delete themselves, and an owner cannot demote themselves. Role changes, disable/delete, and credential
resets revoke the affected administrator's sessions through an injected Sessions public command;
credential reset also increments `passwordVersion`. Deletion is a soft delete to preserve references
from audit and future historical records. Every success, failure, and authorization denial is written
through the append-only English audit service without credentials or raw identifiers in audit context.
