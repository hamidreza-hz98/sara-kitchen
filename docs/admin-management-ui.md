# Administrator management UI

`/dashboard/admins` is a server-protected management surface backed by the administrator lifecycle APIs.

## Behaviour

- Search, role, status, sort, page, and page-size state is stored in the URL.
- The table becomes administrator cards below the desktop breakpoint.
- Controls are rendered from exact permissions; every API repeats authorization server-side.
- The signed-in administrator is labelled and cannot disable or delete their own account. Their session shortcut opens `/dashboard/sessions`.
- Disable, deletion, credential reset, and revoking all sessions explain their consequence and require explicit confirmation. Deletion is offered only after an account is disabled.
- Server-redacted identifiers render as restricted rather than being inferred client-side.
- Create and edit share server validation rules. Role changes require `admins:assign-role`.

## Session control

`POST /api/admins/:adminId/sessions` revokes every active session for the target administrator with the `security` reason and creates an immutable English audit event. It requires `admins:update`, origin/CSRF validation, and never exposes session tokens.
