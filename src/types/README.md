# Shared types

Cross-cutting TypeScript contracts belong here when no single domain module owns them.

- Prefer inferred types from validation schemas and constants instead of duplicating shapes manually.
- Domain entities and service contracts stay inside their owning `src/server/modules/*` module.
- Client-facing data transfer objects must be serializable and must not expose Mongoose documents or private fields.
- Use branded or narrow types for values such as euro cents, identifiers, locale codes, and order codes when they prevent real mistakes.
- Avoid global ambient declarations unless a framework integration requires them.

Add focused files and a selective barrel only after concrete shared types exist.
