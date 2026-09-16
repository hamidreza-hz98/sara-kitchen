# Database infrastructure

- Import the server-only public API from `@/server/database`.
- `connectToDatabase()` owns process-level Mongoose connection reuse; never disconnect per request.
- `createBaseSchema()` is mandatory for domain entity schemas and owns common persistence metadata.
- `connection-manager.ts` and `schema/` are implementation/test surfaces; application adapters and
  modules use the public barrel.
- Domain schemas and models remain private to their owning module.

See `docs/database-connection.md` and `docs/schema-conventions.md` for lifecycle and modeling rules.
