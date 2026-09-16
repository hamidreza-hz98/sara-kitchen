# Validations

Reusable boundary-validation schemas belong here.

- Use one authoritative schema for equivalent form, Route Handler, and service inputs when their contracts are identical.
- Validate and normalize untrusted data before it reaches domain services.
- Keep persistence-only invariants in the domain model as an additional defense.
- Separate localized presentation messages from stable validation issue codes.
- Never trust client-calculated prices, permissions, ownership, payment state, or file metadata.

Feature-specific schemas may live in their server module and be re-exported only when a client form genuinely shares them.

Implemented contracts:

- [`env`](./env/README.md) — fail-fast server/client environment parsing and exposure controls.
- [`request`](./request/README.md) — localized Zod issue mapping plus pagination, sorting, filtering,
  and file-metadata schemas shared by HTTP adapters and forms.
