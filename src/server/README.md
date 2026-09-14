# Server

The Sara Kitchen modular-monolith backend belongs here.

- `modules` will contain domain modules with explicit public APIs.
- Shared server infrastructure will contain database, authentication, logging, storage, jobs, and integration foundations.
- Server Components call module services directly instead of making HTTP requests back into this Next.js process.
- Route Handlers adapt HTTP requests to the same services for browser calls, uploads, webhooks, and external clients.
- Enforce authentication, authorization, validation, ownership, idempotency, and audit logging in server code rather than relying on hidden UI controls.
- Mark server-only entry points with `server-only` and never export secrets or database models into client bundles.

Detailed module boundaries and dependency directions are defined by SK-0013.
