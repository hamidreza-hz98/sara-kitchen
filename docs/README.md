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

- [`about-settings.md`](./about-settings.md) — staged localized About content, structured rich text, kitchen/team/value/story configuration, calls to action, and Media-boundary validation;
- [`adr/`](./adr/README.md) — accepted architecture decisions, alternatives, consequences, and revisit triggers;
- [`architecture.md`](./architecture.md) — modular-monolith dependency rules and module contracts;
- [`admin-management.md`](./admin-management.md) — administrator CRUD, permission, last-owner, session-revocation, and audit invariants;
- [`admin-management-ui.md`](./admin-management-ui.md) — responsive administrator list/edit controls, URL query state, permissions, confirmations, and session management;
- [`address-model.md`](./address-model.md) — address ownership, locale-neutral delivery data, GeoJSON/postal validation, provider metadata, and one-default invariants;
- [`address-crud.md`](./address-crud.md) — owner-scoped customer operations, read-only admin access, default-address consistency, audit privacy, and checkout-time delivery-zone verification;
- [`address-editor.md`](./address-editor.md) — reusable accessible address fields, Leaflet marker selection, geolocation-denial fallback, attribution, and GeoJSON coordinate ordering;
- [`api-contract.md`](./api-contract.md) — typed JSON envelopes, public error taxonomy, request IDs, and internal-error safety;
- [`cache-revalidation.md`](./cache-revalidation.md) — public content tags, dependency-aware reads, targeted mutation expiry, and visibility timing;
- [`cart-model.md`](./cart-model.md) — server-side cart identities, lines, pricing snapshot, lifecycle invariants, active uniqueness, and terminal-only TTL cleanup;
- [`cart-availability.md`](./cart-availability.md) — shared cart/checkout orderability checks, service windows, cutoff, lead time, delivery area, optional stock, and recoverable stale-cart corrections;
- [`cart-crud.md`](./cart-crud.md) — identity-scoped cart operations, authoritative recalculation, expiry, optimistic version conflicts, privacy, and audit behavior;
- [`cart-merge.md`](./cart-merge.md) — transactional guest-login merge rules, quantity caps, unavailable-item notices, customer preference precedence, conflicts, and idempotent replay;
- [`cart-recommendations.md`](./cart-recommendations.md) — deterministic related/category/featured ranking, explainability, privacy, bounded catalog work, localization, and cart-render failure isolation;
- [`global-cart-state.md`](./global-cart-state.md) — server-authoritative optimistic cart state, mutation sequencing, rollback, shared badge state, cross-tab invalidation, and authentication merge refresh;
- [`cart-step-one.md`](./cart-step-one.md) — responsive cart items, corrections, notes, authoritative summary, and non-blocking recommendations;
- [`cart-step-two.md`](./cart-step-two.md) — sign-in gate, pickup/address choice, Porto delivery eligibility, settings-based distance fees, and the review bridge;
- [`cart-step-three.md`](./cart-step-three.md) — final review, published policy consent, MB Way selection, retry safety, and fail-closed payment activation;
- [`atomic-checkout.md`](./atomic-checkout.md) — transactional order/payment creation, consent evidence, idempotent sandbox initiation, and uncertain-outcome recovery;
- [`cart-pricing-engine.md`](./cart-pricing-engine.md) — authoritative integer-cent cart totals, discount timing, distance-band delivery, free-delivery threshold, adjustments, and explicit MVP tax policy;
- [`code-quality.md`](./code-quality.md) — strict compiler, lint, import, runtime, and negative-test gates;
- [`contact-settings.md`](./contact-settings.md) — validated multilingual contact details, Porto location/service area, business hours, safe map configuration, and public projection.
- [`contact-submission-model.md`](./contact-submission-model.md) — normalized contact identity, inbox workflow, consent evidence, bounded spam metadata, and TTL retention policy.
- [`contact-submission-flow.md`](./contact-submission-flow.md) — same-origin/rate-limited public submission, persistence-first notification, protected inbox operations, and retention-safe deletion.
- [`contact-management-ui.md`](./contact-management-ui.md) — responsive inbox, URL state, detail workflow, assignment/notes, retention-safe actions, and inert message rendering.
- [`customer-privacy.md`](./customer-privacy.md) — customer management authorization, PII projection, self-service export, anonymization, and historical-order retention.
- [`customer-management-ui.md`](./customer-management-ui.md) — responsive customer list/details, order/spend summaries, URL state, sensitive-data minimization, and permission-gated actions.
- [`dashboard-shell.md`](./dashboard-shell.md) — protected management route, responsive shell, permission-filtered navigation, and admin-session handoff;
- [`database-connection.md`](./database-connection.md) — cached Mongoose lifecycle, pool/timeouts, retry behavior, and secret-safe errors;
- [`definition-of-done.md`](./definition-of-done.md) — required delivery evidence for tests, translations, authorization, logging, validation, accessibility, responsive layout, documentation, and security;
- [`design-tokens.md`](./design-tokens.md) — typed color, typography, spacing, breakpoint, radius, shadow, and motion decisions traced to the supplied UI/UX exports;
- [`dish-domain-rules.md`](./dish-domain-rules.md) — sellable portions, availability, made-to-order stock, tax, allergen/dietary, quantity, and lead-time contracts;
- [`dish-pricing.md`](./dish-pricing.md) — authoritative integer-cent discounts, schedules, half-up rounding, validation, and display metadata;
- [`dish-crud.md`](./dish-crud.md) — lifecycle, reference integrity, acyclic dish relations, SEO/audit/cache effects, and concurrency behavior;
- [`automatic-seo.md`](./automatic-seo.md) — generated entity metadata, manual-field ownership, idempotency, and compensating creation rollback;
- [`static-seo.md`](./static-seo.md) — approved static routes, excluded surfaces, localized metadata management, authorization, and uniqueness guarantees;
- [`next-metadata.md`](./next-metadata.md) — locale-aware Next.js metadata mapping, site settings, social images, fallbacks, and rendered-head verification;
- [`seo-admin-controls.md`](./seo-admin-controls.md) — reusable entity controls, manual/automatic ownership, guidance, previews, and static-page workflow;
- [`structured-data.md`](./structured-data.md) — validated JSON-LD eligibility, source provenance, safe rendering, and schema fixtures;
- [`sitemap.md`](./sitemap.md) — public discovery projections, same-URL locale alternates, XML/sharding policy, and live URL verification;
- [`robots-and-manifest.md`](./robots-and-manifest.md) — deployment-aware crawler rules and the localized, branded install manifest;
- [`dish-catalog-query.md`](./dish-catalog-query.md) — localized public projection, indexed menu filters, allergen exclusions, sorting, and stable pagination;
- [`dish-view-counting.md`](./dish-view-counting.md) — meaningful-view policy, privacy-safe duplicate suppression, post-response persistence, and failure isolation;
- [`dependencies.md`](./dependencies.md) — direct package inventory, purpose, runtime boundaries, and selection policy.
- [`environment.md`](./environment.md) — validated server/client variables, setup, and secret boundaries.
- [`error-monitoring.md`](./error-monitoring.md) — Sentry runtimes, privacy redaction, source maps, release tags, alert routing, and verification.
- [`faq-settings.md`](./faq-settings.md) — staged ordered FAQs, per-item locale fallback, immutable authoring operations, active projection, and FAQPage structured-data handoff.
- [`operational-metrics.md`](./operational-metrics.md) — typed signals, live instrumentation boundaries, dashboard queries, and launch alerts.
- [`order-notifications.md`](./order-notifications.md) — localized order notices, durable outbox, retry/dead-letter behavior, private inbox, and live WhatsApp activation boundary.
- [`order-list-ui.md`](./order-list-ui.md) — responsive order management, URL filters, consistent status counts, safe actions, and query behavior.
- [`order-details-ui.md`](./order-details-ui.md) — protected direct-link order details, snapshots, timeline, payment events, and safe actions.
- [`payment-result.md`](./payment-result.md) — authenticated payment-result verification, delayed-webhook polling, and safe terminal guidance.
- [`media-model.md`](./media-model.md) — Media storage, variants, processing, localization, deletion, and index invariants.
- [`feedback.md`](./feedback.md) — localized notification queues, safe confirmations, connectivity status, and route/global recovery.
- [`formatting-and-hooks.md`](./formatting-and-hooks.md) — deterministic formatting and staged-commit safeguards.
- [`fonts.md`](./fonts.md) — local licensed font assets, script-aware fallback selection, provenance, and layout-shift verification.
- [`health-readiness.md`](./health-readiness.md) — process liveness, MongoDB/MinIO dependency checks, safe 503 responses, and deployment gates.
- [`homepage-settings.md`](./homepage-settings.md) — staged homepage merchandising, localization, ordering, limits, and cross-module reference policy.
- [`idempotency.md`](./idempotency.md) — checkout/payment/webhook keys, fingerprints, replay, conflicts, retention, and concurrent delivery.
- [`request-security.md`](./request-security.md) — browser CSRF/origin policy, Server Action checks, and signed payment webhook boundary.
- [`security-headers.md`](./security-headers.md) — production response headers, narrowly allowed browser origins, secure cookies, and CSP tradeoffs.
- [`secret-management.md`](./secret-management.md) — secret ownership, deployment storage, rotation, incident response, and repository/build scanning.
- [`authentication-rate-limits.md`](./authentication-rate-limits.md) — independent IP/identity/actor buckets, thresholds, privacy, and retry contract.
- [`audit-logging.md`](./audit-logging.md) — immutable event schema, privacy constraints, indexes, retention, and tamper boundaries.
- [`activity-log-ui.md`](./activity-log-ui.md) — permission-gated responsive audit timeline, indexed URL filters, safe projection, and inert details rendering.
- [`structured-logging.md`](./structured-logging.md) — typed operational events, local/production formatter parity, deployment correlation, and recursive redaction.
- [`local-infrastructure.md`](./local-infrastructure.md) — healthy MongoDB/MinIO startup, persistence, credentials, and operations.
- [`localization.md`](./localization.md) — locale routing, cookie persistence, catalogs, authoring rules, and acceptance coverage.
- [`language-settings.md`](./language-settings.md) — runtime locale availability, defaults, fallback order, localized selector labels, and maintenance visibility.
- [`media-deletion.md`](./media-deletion.md) — reference-safe soft deletion, recycle retention, force-delete prohibition, and future purge constraints.
- [`media-library.md`](./media-library.md) — responsive dashboard media list, URL state, filtering, preview, editing, selection, and safe-delete behavior.
- [`localized-formatting.md`](./localized-formatting.md) — EUR, numeric, unit, relative-time, date/time defaults, input contracts, and locale examples.
- [`mui-app-router.md`](./mui-app-router.md) — streaming Emotion cache, provider order, cascade layers, fonts, and hydration acceptance.
- [`right-to-left.md`](./right-to-left.md) — locale direction, RTL Emotion processing, logical CSS, icon policy, and visual verification.
- [`request-validation.md`](./request-validation.md) — transport parsing, strict Zod schemas, localized field-safe issues, and file-metadata limits.
- [`schema-conventions.md`](./schema-conventions.md) — ObjectId, timestamps, actor provenance, soft deletion, normalized search, versions, and JSON rules.
- [`settings-storage.md`](./settings-storage.md) — singleton section registry, staged/direct revisions, editor provenance, safe payload envelope, and sequential migrations.
- [`settings-service.md`](./settings-service.md) — typed Settings reads/writes, authorization, staged publication, path-only audit diffs, and precise public-cache revalidation.
- [`settings-pages.md`](./settings-pages.md) — registry-driven localized settings forms, specialized controls, previews, publication state, permissions, and unsaved-change protection.
- [`social-settings.md`](./social-settings.md) — allow-listed platforms/icons, safe URL-or-handle destinations, localized labels, ordering, and render-ready public links.
- [`slugs.md`](./slugs.md) — canonical generation, admin overrides, reserved routes, deterministic collisions, and unique-index concurrency rules.
- [`storefront-shell.md`](./storefront-shell.md) — supplied-layout mapping, responsive public navigation, locale/cart/account controls, footer, and keyboard behavior.
- [`theme.md`](./theme.md) — executable palette, typography, shape, elevation, motion, component overrides, and responsive showcase verification.
- [`terms-policy-settings.md`](./terms-policy-settings.md) — immutable translated policy versions, transactional publication, append-only account/order consent receipts, and historical integrity traces.
- [`translation-values.md`](./translation-values.md) — embedded translation validation, localized selection, fallback order, and direction metadata.
- [`ui-primitives.md`](./ui-primitives.md) — shared component contracts, accessibility/localization rules, rich-content safety, and showcase coverage.
