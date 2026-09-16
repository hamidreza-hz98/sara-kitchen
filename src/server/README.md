# Server

The Sara Kitchen modular-monolith backend belongs here.

- `modules` will contain domain modules with explicit public APIs.
- Shared server infrastructure will contain database, authentication, logging, storage, jobs, and integration foundations.
- `database/` owns the process-wide Mongoose connection manager. Request handlers call
  `connectToDatabase()` and never disconnect per request; only graceful shutdown and isolated tests
  call `disconnectFromDatabase()`.
- `slugs/` owns canonical normalization, reserved paths, deterministic collision resolution, and the
  shared unique schema field; modules provide collection-specific existence checks and retries.
- `http/` owns JSON response envelopes, public error taxonomy, request IDs, and the Route Handler
  boundary that prevents internal error details from reaching clients.
- `cache/` owns public content tags and post-commit invalidation adapters; personalized data is not cached there.
- Server Components call module services directly instead of making HTTP requests back into this Next.js process.
- Route Handlers adapt HTTP requests to the same services for browser calls, uploads, webhooks, and external clients.
- Enforce authentication, authorization, validation, ownership, idempotency, and audit logging in server code rather than relying on hidden UI controls.
- Mark server-only entry points with `server-only` and never export secrets or database models into client bundles.

Detailed module boundaries and dependency directions are defined by SK-0013.
