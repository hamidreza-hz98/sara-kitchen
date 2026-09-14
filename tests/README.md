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
- `pnpm test:integration` (or `pnpm integration`) runs integration and contract tests in Node.
- `pnpm test:quality` proves the real TypeScript, ESLint, and import-boundary commands reject deliberate violations.
- `pnpm test:hooks` proves malformed staged source is rejected, valid source commits, and unrelated work is preserved.
- `pnpm test:watch` starts the Vitest development watcher.
- `pnpm test:coverage` writes V8 text, HTML, and LCOV coverage reports.
- `pnpm test:e2e:install` installs the pinned Chromium browser once per machine or CI image.
- `pnpm test:e2e` starts Next.js on port 3100 and runs Playwright plus axe checks.
- `pnpm e2e` is the short alias for the same browser suite.
- `pnpm test:scripts` verifies the common script inventory and safe database-operation contract.
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
  cache the runtime binary or provide `MONGOMS_SYSTEM_BINARY`.
- Tests must never use production MongoDB, MinIO, payment, messaging, or email credentials.
