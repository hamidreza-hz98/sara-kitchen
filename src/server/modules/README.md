# Server modules

This directory contains the Sara Kitchen modular monolith. Each child directory is an independently owned domain boundary with one public entry point: its root `index.ts`.

## Public API rule

- Code outside a module imports only `@/server/modules/<module>`.
- A module may import another module only through that public entry point and only when the dependency is allowed by `docs/architecture.md`.
- Never import another module’s schema, model, repository, mapper, policy, validation, or test files.
- Relative imports may stay within the current module but may not traverse into a sibling module.
- Mongoose model registration and database queries remain private to the module that owns the collection.

The executable check is `pnpm check:boundaries`. Its focused contract tests run with `pnpm test:boundaries`.

## Required implementation shape

Every implemented module follows the blueprint in `_template/README.md`. Layers are created when they acquire real domain code; empty implementations and placeholder exports are not allowed. Until then, the module’s README and public `index.ts` establish its ownership boundary without pretending functionality exists.
