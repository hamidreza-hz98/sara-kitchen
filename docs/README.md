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
- [`api-contract.md`](./api-contract.md) — typed JSON envelopes, public error taxonomy, request IDs, and internal-error safety;
- [`cache-revalidation.md`](./cache-revalidation.md) — public content tags, dependency-aware reads, targeted mutation expiry, and visibility timing;
- [`code-quality.md`](./code-quality.md) — strict compiler, lint, import, runtime, and negative-test gates;
- [`dashboard-shell.md`](./dashboard-shell.md) — protected management route, responsive shell, permission-filtered navigation, and admin-session handoff;
- [`database-connection.md`](./database-connection.md) — cached Mongoose lifecycle, pool/timeouts, retry behavior, and secret-safe errors;
- [`definition-of-done.md`](./definition-of-done.md) — required delivery evidence for tests, translations, authorization, logging, validation, accessibility, responsive layout, documentation, and security;
- [`design-tokens.md`](./design-tokens.md) — typed color, typography, spacing, breakpoint, radius, shadow, and motion decisions traced to the supplied UI/UX exports;
- [`dish-domain-rules.md`](./dish-domain-rules.md) — sellable portions, availability, made-to-order stock, tax, allergen/dietary, quantity, and lead-time contracts;
- [`dish-pricing.md`](./dish-pricing.md) — authoritative integer-cent discounts, schedules, half-up rounding, validation, and display metadata;
- [`dependencies.md`](./dependencies.md) — direct package inventory, purpose, runtime boundaries, and selection policy.
- [`environment.md`](./environment.md) — validated server/client variables, setup, and secret boundaries.
- [`error-monitoring.md`](./error-monitoring.md) — Sentry runtimes, privacy redaction, source maps, release tags, alert routing, and verification.
- [`operational-metrics.md`](./operational-metrics.md) — typed signals, live instrumentation boundaries, dashboard queries, and launch alerts.
- [`media-model.md`](./media-model.md) — Media storage, variants, processing, localization, deletion, and index invariants.
- [`feedback.md`](./feedback.md) — localized notification queues, safe confirmations, connectivity status, and route/global recovery.
- [`formatting-and-hooks.md`](./formatting-and-hooks.md) — deterministic formatting and staged-commit safeguards.
- [`fonts.md`](./fonts.md) — local licensed font assets, script-aware fallback selection, provenance, and layout-shift verification.
- [`health-readiness.md`](./health-readiness.md) — process liveness, MongoDB/MinIO dependency checks, safe 503 responses, and deployment gates.
- [`idempotency.md`](./idempotency.md) — checkout/payment/webhook keys, fingerprints, replay, conflicts, retention, and concurrent delivery.
- [`request-security.md`](./request-security.md) — browser CSRF/origin policy, Server Action checks, and signed payment webhook boundary.
- [`security-headers.md`](./security-headers.md) — production response headers, narrowly allowed browser origins, secure cookies, and CSP tradeoffs.
- [`secret-management.md`](./secret-management.md) — secret ownership, deployment storage, rotation, incident response, and repository/build scanning.
- [`authentication-rate-limits.md`](./authentication-rate-limits.md) — independent IP/identity/actor buckets, thresholds, privacy, and retry contract.
- [`audit-logging.md`](./audit-logging.md) — immutable event schema, privacy constraints, indexes, retention, and tamper boundaries.
- [`structured-logging.md`](./structured-logging.md) — typed operational events, local/production formatter parity, deployment correlation, and recursive redaction.
- [`local-infrastructure.md`](./local-infrastructure.md) — healthy MongoDB/MinIO startup, persistence, credentials, and operations.
- [`localization.md`](./localization.md) — locale routing, cookie persistence, catalogs, authoring rules, and acceptance coverage.
- [`media-deletion.md`](./media-deletion.md) — reference-safe soft deletion, recycle retention, force-delete prohibition, and future purge constraints.
- [`media-library.md`](./media-library.md) — responsive dashboard media list, URL state, filtering, preview, editing, selection, and safe-delete behavior.
- [`localized-formatting.md`](./localized-formatting.md) — EUR, numeric, unit, relative-time, date/time defaults, input contracts, and locale examples.
- [`mui-app-router.md`](./mui-app-router.md) — streaming Emotion cache, provider order, cascade layers, fonts, and hydration acceptance.
- [`right-to-left.md`](./right-to-left.md) — locale direction, RTL Emotion processing, logical CSS, icon policy, and visual verification.
- [`request-validation.md`](./request-validation.md) — transport parsing, strict Zod schemas, localized field-safe issues, and file-metadata limits.
- [`schema-conventions.md`](./schema-conventions.md) — ObjectId, timestamps, actor provenance, soft deletion, normalized search, versions, and JSON rules.
- [`slugs.md`](./slugs.md) — canonical generation, admin overrides, reserved routes, deterministic collisions, and unique-index concurrency rules.
- [`storefront-shell.md`](./storefront-shell.md) — supplied-layout mapping, responsive public navigation, locale/cart/account controls, footer, and keyboard behavior.
- [`theme.md`](./theme.md) — executable palette, typography, shape, elevation, motion, component overrides, and responsive showcase verification.
- [`translation-values.md`](./translation-values.md) — embedded translation validation, localized selection, fallback order, and direction metadata.
- [`ui-primitives.md`](./ui-primitives.md) — shared component contracts, accessibility/localization rules, rich-content safety, and showcase coverage.
