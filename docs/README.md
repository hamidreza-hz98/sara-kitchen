# Sara Kitchen documentation

This directory is the durable technical and operational record for the project.

Planned documents include:

- product scope and non-functional requirements;
- architecture overview and Architecture Decision Records;
- design-screen and asset inventories;
- data model, API, localization, security, and privacy decisions;
- setup, deployment, migration, backup, recovery, and incident runbooks;
- content import formats and launch acceptance records.

Documentation must describe the implemented system. Update the relevant document in the same change whenever behavior, operations, or an accepted decision changes.

Current records:

- [`adr/`](./adr/README.md) — accepted architecture decisions, alternatives, consequences, and revisit triggers;
- [`architecture.md`](./architecture.md) — modular-monolith dependency rules and module contracts;
- [`code-quality.md`](./code-quality.md) — strict compiler, lint, import, runtime, and negative-test gates;
- [`definition-of-done.md`](./definition-of-done.md) — required delivery evidence for tests, translations, authorization, logging, validation, accessibility, responsive layout, documentation, and security;
- [`design-tokens.md`](./design-tokens.md) — typed color, typography, spacing, breakpoint, radius, shadow, and motion decisions traced to the supplied UI/UX exports;
- [`dependencies.md`](./dependencies.md) — direct package inventory, purpose, runtime boundaries, and selection policy.
- [`environment.md`](./environment.md) — validated server/client variables, setup, and secret boundaries.
- [`formatting-and-hooks.md`](./formatting-and-hooks.md) — deterministic formatting and staged-commit safeguards.
- [`fonts.md`](./fonts.md) — local licensed font assets, script-aware fallback selection, provenance, and layout-shift verification.
- [`local-infrastructure.md`](./local-infrastructure.md) — healthy MongoDB/MinIO startup, persistence, credentials, and operations.
- [`localization.md`](./localization.md) — locale routing, cookie persistence, catalogs, authoring rules, and acceptance coverage.
- [`localized-formatting.md`](./localized-formatting.md) — EUR, numeric, unit, relative-time, date/time defaults, input contracts, and locale examples.
- [`mui-app-router.md`](./mui-app-router.md) — streaming Emotion cache, provider order, cascade layers, fonts, and hydration acceptance.
- [`right-to-left.md`](./right-to-left.md) — locale direction, RTL Emotion processing, logical CSS, icon policy, and visual verification.
- [`theme.md`](./theme.md) — executable palette, typography, shape, elevation, motion, component overrides, and responsive showcase verification.
