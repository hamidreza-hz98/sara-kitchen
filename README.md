# Sara Kitchen

Online menu, ordering, and administration platform for Sara Kitchen, a Persian homemade-food
business serving Porto, Portugal. The application is a TypeScript modular monolith built with the
Next.js App Router, Mongoose, next-intl, MUI, and serverless-compatible backend modules.

The product is in foundation development. The implemented architecture and operational truth live
in [`docs`](./docs/README.md); planned functionality in the project task list is not implied to be
available merely because its module boundary exists.

## Requirements

- Node.js `>=24.0.0 <25`
- pnpm `>=11.19.0 <12` through Corepack
- local values for the variables described in [the environment guide](./docs/environment.md)
- Docker Desktop with Compose v2 for local MongoDB and MinIO
- Chromium installed through Playwright before the first end-to-end run

Package and runtime ranges are enforced by `package.json`. The pnpm lockfile is committed and must
not be regenerated with npm, Yarn, or Bun.

## Clean-checkout setup

```powershell
corepack enable
pnpm install --frozen-lockfile
Copy-Item .env.example .env.local
```

Replace every `replace-with-*` value in `.env.local` as documented in
[`docs/environment.md`](./docs/environment.md). Never commit `.env.local` or real credentials.

Start the development server and open [http://localhost:3000](http://localhost:3000):

```powershell
pnpm infra:up
pnpm dev
```

Run the complete local/CI-equivalent gate before committing:

```powershell
pnpm verify
```

## Application commands

| Command       | Purpose                                                               |
| ------------- | --------------------------------------------------------------------- |
| `pnpm dev`    | Start the Next.js development server with hot reload.                 |
| `pnpm build`  | Validate configuration and create an optimized production build.      |
| `pnpm start`  | Serve an existing production build; run `pnpm build` first.           |
| `pnpm verify` | Run formatting, lint, types, tests, boundaries, and production build. |

## Local infrastructure commands

| Command             | Purpose                                                                |
| ------------------- | ---------------------------------------------------------------------- |
| `pnpm infra:up`     | Build/start MongoDB and MinIO, wait for health, and create the bucket. |
| `pnpm infra:down`   | Stop containers without deleting named-volume data.                    |
| `pnpm infra:status` | Show current service and health state.                                 |
| `pnpm infra:logs`   | Print the latest 100 MongoDB and MinIO log lines.                      |
| `pnpm infra:config` | Render and validate the resolved Compose model.                        |

Use the local application credentials and endpoints documented in
[`docs/local-infrastructure.md`](./docs/local-infrastructure.md). The stack is loopback-only and its
committed credentials must never be reused outside local development.

Development and production startup are intentionally long-running. Use `Ctrl+C` for a graceful local
shutdown.

## Code-quality commands

| Command                 | Purpose                                                       |
| ----------------------- | ------------------------------------------------------------- |
| `pnpm format`           | Format supported repository files with pinned Prettier rules. |
| `pnpm format:check`     | Verify formatting without writing files.                      |
| `pnpm lint`             | Run zero-warning, type-aware ESLint without fixes.            |
| `pnpm lint:fix`         | Apply safe ESLint fixes and fail on remaining violations.     |
| `pnpm typecheck`        | Run strict TypeScript checking without emitting files.        |
| `pnpm check:locales`    | Validate locale namespaces, keys, values, and placeholders.   |
| `pnpm check:boundaries` | Validate source-layer and domain-module import rules.         |
| `pnpm security:audit`   | Fail on Critical production dependency advisories.            |

Formatting, staged-file behavior, and architectural restrictions are documented in
[`docs/formatting-and-hooks.md`](./docs/formatting-and-hooks.md) and
[`docs/code-quality.md`](./docs/code-quality.md).

`pnpm security:audit` queries the package registry and therefore stays outside the deterministic
`pnpm verify` command. Run it whenever production dependencies or the lockfile change and before a
production release.

## Test commands

| Command                 | Purpose                                                                   |
| ----------------------- | ------------------------------------------------------------------------- |
| `pnpm test`             | Run all deterministic non-browser suites once.                            |
| `pnpm unit`             | Alias for the unit/component Vitest suite.                                |
| `pnpm test:unit`        | Run unit and component tests once.                                        |
| `pnpm integration`      | Alias for integration and contract tests.                                 |
| `pnpm test:integration` | Run Node-based integration and contract tests once.                       |
| `pnpm test:watch`       | Start Vitest in watch mode.                                               |
| `pnpm test:coverage`    | Generate V8 text, HTML, and LCOV coverage.                                |
| `pnpm e2e`              | Alias for the Playwright browser suite.                                   |
| `pnpm test:e2e`         | Start the app and run Playwright/axe checks.                              |
| `pnpm test:e2e:ui`      | Open Playwright's interactive test UI.                                    |
| `pnpm test:e2e:install` | Install the pinned Chromium runtime for CI or machines without a browser. |
| `pnpm test:boundaries`  | Unit-test the architecture checker.                                       |
| `pnpm test:quality`     | Prove deliberate type, lint, and import violations fail.                  |
| `pnpm test:hooks`       | Exercise malformed and valid commits in a disposable Git repository.      |
| `pnpm test:scripts`     | Verify this common command contract and database-operation safety.        |
| `pnpm test:infra`       | Verify the local infrastructure definition without starting Docker.       |
| `pnpm test:adr`         | Verify the accepted ADR inventory, structure, and index links.            |
| `pnpm test:dod`         | Verify the pull-request template retains every delivery gate.             |

See [`tests/README.md`](./tests/README.md) for suite boundaries and external-service safety rules.

Foundational architecture choices and their trade-offs are indexed in
[`docs/adr/README.md`](./docs/adr/README.md).

Every completed change follows the evidence requirements in
[`docs/definition-of-done.md`](./docs/definition-of-done.md), reflected in the repository's pull-request template.

## Database operation commands

| Command           | Alias          | Purpose                                           |
| ----------------- | -------------- | ------------------------------------------------- |
| `pnpm db:seed`    | `pnpm seed`    | Plan deterministic application-data seeding.      |
| `pnpm db:migrate` | `pnpm migrate` | Plan ordered, idempotent data migrations.         |
| `pnpm db:indexes` | `pnpm indexes` | Plan synchronization of declared MongoDB indexes. |

These commands default to non-mutating `--plan` mode and currently report zero registered steps.
That is the truthful foundation state: persistence handlers arrive in their dedicated tasks. An
attempt to use `--apply` fails closed until those handlers exist.

```powershell
pnpm db:migrate
pnpm db:migrate --help
pnpm db:migrate --apply
```

Once implemented, apply mode will require validated environment configuration and an explicit
operator action. Never run seed, migration, or index mutation commands against production without a
reviewed runbook and backup/rollback plan.

## Contribution workflow

Development currently happens directly on `master` under the rules in
[`CONTRIBUTING.md`](./CONTRIBUTING.md). Commits use Conventional Commits and must pass the staged
Husky checks. Production deployment always requires separate project-owner approval.
