# Administrator management

SK-0125 provides the server-side administrator lifecycle at `/api/admins`.

## Operations and permissions

| Operation          | Permission                             | Additional invariant                                             |
| ------------------ | -------------------------------------- | ---------------------------------------------------------------- |
| List/detail        | `admins:read`                          | Identifier is returned only with `admins:read-sensitive`.        |
| Create             | `admins:create` + `admins:assign-role` | Identifier is normalized/unique and password is Argon2id-hashed. |
| Update profile     | `admins:update`                        | Unknown and credential/status fields are rejected.               |
| Change role        | `admins:update` + `admins:assign-role` | Cannot demote self or remove the final active owner.             |
| Disable/reactivate | `admins:disable`                       | Cannot disable self or the final active owner.                   |
| Reset credential   | `admins:update`                        | Increments password version and revokes every active session.    |
| Soft delete        | `admins:delete`                        | Cannot delete self or the final active owner.                    |

Disable, role-change, credential-reset, and deletion revoke affected sessions immediately. Session
revocation is injected into the Admins service through the Sessions public API, preserving modular
ownership. Authentication also resolves current account status, role, and password version on every
protected request, so stale sessions fail closed even if a revocation write is delayed.

Deleted administrator records remain available only through an explicit management filter. Their
identifiers stay reserved to protect attribution and prevent account impersonation. Passwords and
hashes never appear in DTOs, audit context, logs, or error responses.

All mutations require the established admin cookie, same-origin/CSRF validation, exact permission,
strict Zod input, optimistic document versioning, and an append-only English audit event.
