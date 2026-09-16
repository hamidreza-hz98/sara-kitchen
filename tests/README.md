# Tests

Cross-feature and system-level test support belongs here.

Organization:

- `tests/integration`: module and persistence integration tests.
- `tests/contract`: Route Handler and external integration contracts.
- `tests/e2e`: Playwright customer and administration journeys.
- `tests/fixtures`: deterministic, non-sensitive test builders and media fixtures.
- `tests/helpers`: test-only infrastructure with no production imports flowing back from application code.
- `tests/unit`: cross-cutting unit tests that do not belong beside one module.
- `tests/component`: React component tests using Testing Library and jsdom.

Focused unit and component tests may be colocated with the source they exercise. Tests must be deterministic, isolated, and safe to run against non-production resources only.

## Commands

- `pnpm test` runs deterministic Vitest, architecture, negative quality-gate, and Git-hook tests once.
- `pnpm test:unit` (or `pnpm unit`) runs unit and component tests in jsdom.
- Localized formatter tests pin English, European Portuguese, and Persian output for EUR cents,
  decimal numbers, units, relative time, and Porto-zone date/time values.
- Shared primitive component tests cover accessible names/roles, safe form actions, focus-triggered
  tooltips, keyboard overlay dismissal, locale-aware links, pagination, image alt intent, loading and
  state announcements, semantic rich content, and unsafe-link rejection.
- Feedback component tests cover FIFO notification delivery, localized dismissal, safe confirmation
  focus, offline/reconnected messaging, and route-loading announcements. Browser tests exercise all
  five demo outcomes and localized not-found routing; the production build validates the global
  fallback entry point.
- Storefront-shell browser tests cover the 390, 768, 1024, and 1440px navigation modes, overflow,
  screenshots, skip-link focus, account-menu and drawer keyboard behavior, cart labelling, clean-URL
  locale switching, Persian drawer mirroring, and axe checks.
- Dashboard policy unit tests cover permission filtering and deep-link resolution. Dashboard-shell
  browser tests cover fail-closed real routes and the data-free development fixture at four
  breakpoints, persistent collapse, keyboard operation, RTL mirroring, and axe checks.
- `pnpm test:integration` (or `pnpm integration`) runs integration and contract tests in Node.
- Request-validation tests exercise JSON/form/query/route/file parsing, localized safe issue mapping,
  and Portuguese/Farsi HTTP 400 responses through the actual health Route Handler.
- `pnpm test:quality` proves the real TypeScript, ESLint, and import-boundary commands reject deliberate violations.
- `pnpm test:api-contract` proves Route Handlers cannot bypass the shared request-ID, response, and safe-error envelope.
- `pnpm test:hooks` proves malformed staged source is rejected, valid source commits, and unrelated work is preserved.
- `pnpm test:watch` starts the Vitest development watcher.
- `pnpm test:coverage` writes V8 text, HTML, and LCOV coverage reports.
- `pnpm test:e2e:install` installs the pinned Chromium browser once per machine or CI image.
- `pnpm test:e2e` starts Next.js on port 3100 and runs Playwright plus axe checks.
- The Windows/CI browser runner uses one worker and Next's Webpack development compiler for stable,
  repeatable route manifests after production-build verification; the production build remains
  Turbopack's default.
- The homepage browser contract also verifies that MUI/Emotion styles arrive in the SSR `<head>`, use
  the `mui` cascade layer, retain unique identifiers across hydration/reload, and emit no runtime
  errors.
- `pnpm e2e` is the short alias for the same browser suite.
- `pnpm test:scripts` verifies the common script inventory and safe database-operation contract.
- `pnpm test:infra` validates the Compose model, image pins, health gates, bucket provisioning, and persistent shutdown contract without requiring Docker.
- `pnpm test:adr` verifies the accepted ADR inventory, metadata, required decision sections, and index links.
- `pnpm test:dod` verifies that the pull-request template and definition-of-done policy retain every required delivery gate.
- `pnpm verify` runs formatting, lint, strict typecheck, all deterministic tests, and a production build.

## Test boundaries

- Vitest uses jsdom by default for React components. Node-only contract or integration tests can add
  `// @vitest-environment node` at the top of the test file.
- Test async Server Components and complete navigation/data flows with Playwright; unit tests cover
  synchronous components and domain behavior.
- Local Playwright runs use the installed Microsoft Edge channel on Windows. CI uses Playwright's
  pinned Chromium and must run `pnpm test:e2e:install` while building its runner image.
- Use MSW for deterministic outbound HTTP contracts such as MB Way and WhatsApp. Never contact a
  real third-party sandbox from the default unit-test command.
- `startTestMongoDatabase` provisions an isolated MongoDB process on demand. It uses
  `mongodb-memory-server-core`, so package installation does not download a MongoDB binary; CI must
  cache the runtime binary or provide `MONGOMS_SYSTEM_BINARY`. On Windows, the helper also discovers
  the standard MongoDB 8.0 installation path before attempting its pinned archive fallback.
- Tests must never use production MongoDB, MinIO, payment, messaging, or email credentials.
