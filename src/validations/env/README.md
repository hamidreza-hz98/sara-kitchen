# Environment validation

Environment variables have two deliberately separate access paths:

- `@/server/environment` is guarded by `server-only` and exposes `getServerEnvironment()` to
  application server code. Its internal core also validates configuration from `next.config.ts`.
- `./client` reads only the allowlisted `NEXT_PUBLIC_SITE_URL` value through a statically analyzable
  property access that Next.js can inline safely.
- `./client-schema` and `./server-schema` remain separate so client imports cannot transitively pull
  server configuration into their module graph. Application features should not bypass the validated
  accessors with direct `process.env` reads.

Adding a variable requires updating the relevant schema, key allowlist, `.env.example`, tests, and
`docs/environment.md`. Secrets must never use the `NEXT_PUBLIC_` prefix.
