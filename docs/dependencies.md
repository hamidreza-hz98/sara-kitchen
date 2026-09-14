# Dependency manifest

This document records why each direct dependency belongs in Sara Kitchen. `package.json` and
`pnpm-lock.yaml` remain the executable source of truth; update this manifest in the same commit
whenever a direct dependency is added, removed, or materially repurposed.

## Selection policy

- Production packages are pinned exactly to make installs reproducible. Upgrades are deliberate
  changes reviewed together with their lockfile diff.
- Prefer platform APIs before adding another package. For example, opaque session and reset tokens
  use Node.js `crypto`; `jose` is reserved for data that genuinely requires a signed JWT/JWE.
- Database, password hashing, object storage, and image processing run only in the Next.js Node.js
  runtime. They must not be imported into client components or Edge handlers.
- Rich text is stored as validated Tiptap JSON, rendered to HTML on the server, and sanitized before
  it crosses a trust boundary. Sanitization is still required for imported or legacy HTML.
- Browser-heavy features such as the editor and maps should be loaded only on routes that use them.
- TanStack Query and Table are for interactive dashboard workflows. Public server-rendered pages
  should use Next.js data loading and caching directly unless client-side interaction requires them.
- `pnpm-workspace.yaml` explicitly permits install scripts only for native packages needed at
  runtime or during compilation. New build-script requests must be reviewed rather than approved
  globally.

## Production dependencies

| Package                   | Pinned version | Purpose and usage boundary                                                                                                       |
| ------------------------- | -------------: | -------------------------------------------------------------------------------------------------------------------------------- |
| `next`                    |       `16.3.5` | App Router framework, route handlers, Server Components, and serverless application runtime.                                     |
| `react`                   |       `19.3.0` | Component and rendering model used by Next.js.                                                                                   |
| `react-dom`               |       `19.3.0` | Browser and server DOM renderer required by Next.js.                                                                             |
| `@mui/material`           |        `9.4.0` | Accessible UI component foundation for the dashboard and storefront.                                                             |
| `@mui/icons-material`     |        `9.4.0` | MUI-aligned application icons; import icons individually to preserve tree shaking.                                               |
| `@mui/material-nextjs`    |        `9.4.0` | Official MUI App Router cache/streaming integration.                                                                             |
| `@emotion/cache`          |      `11.14.0` | Creates the Emotion cache used by MUI, including direction-aware style insertion.                                                |
| `@emotion/react`          |      `11.14.0` | Emotion React runtime and theme-aware CSS composition required by MUI.                                                           |
| `@emotion/server`         |      `11.11.0` | Server-side Emotion utilities required by the MUI Next.js integration.                                                           |
| `@emotion/styled`         |      `11.14.1` | Styled component API used by MUI theme components and overrides.                                                                 |
| `stylis-plugin-rtl`       |        `2.1.1` | Mirrors generated CSS for Farsi RTL presentation through the Emotion cache.                                                      |
| `next-intl`               |       `4.14.5` | English, Portuguese, and Farsi messages, formatting, locale negotiation, and request configuration without locale path segments. |
| `mongoose`                |       `9.10.0` | MongoDB schemas, indexes, validation hooks, and repositories; server-only Node.js runtime.                                       |
| `zod`                     |        `4.6.5` | Shared runtime validation for environment variables, forms, commands, and API boundaries.                                        |
| `react-hook-form`         |       `7.88.0` | Performant client form state for admin and customer workflows.                                                                   |
| `@hookform/resolvers`     |        `5.9.1` | Connects React Hook Form to the shared Zod schemas.                                                                              |
| `argon2`                  |       `0.45.1` | Argon2id password hashing and verification; server-only native Node.js dependency.                                               |
| `jose`                    |       `6.2.12` | Standards-compliant JWT/JWS/JWE support for signed, short-lived tokens when an opaque database-backed token is unsuitable.       |
| `minio`                   |        `8.0.7` | S3-compatible object operations against MinIO for private uploads, metadata, and presigned access; server-only.                  |
| `sharp`                   |       `0.35.4` | Server-side image validation, resizing, compression, and WebP conversion.                                                        |
| `@tiptap/core`            |       `3.31.3` | Headless rich-text schema and extension foundation.                                                                              |
| `@tiptap/pm`              |       `3.31.3` | Version-aligned ProseMirror primitives required by Tiptap.                                                                       |
| `@tiptap/react`           |       `3.31.3` | Client editor bindings for dashboard rich-text forms.                                                                            |
| `@tiptap/starter-kit`     |       `3.31.3` | Curated baseline of rich-text nodes, marks, history, and editing commands.                                                       |
| `@tiptap/static-renderer` |       `3.31.3` | Converts trusted Tiptap JSON to display markup without mounting an editor.                                                       |
| `sanitize-html`           |       `2.17.7` | Server-side allowlist sanitizer for rendered, imported, or legacy rich-text HTML.                                                |
| `server-only`             |        `0.0.1` | Next.js build-time guard that prevents marked server modules from entering Client Component graphs.                              |
| `leaflet`                 |        `1.9.4` | Map geometry, markers, coordinates, and distance-friendly browser map primitives.                                                |
| `react-leaflet`           |        `5.0.0` | React 19 bindings for Leaflet on address and settings map screens.                                                               |
| `@tanstack/react-table`   |        `9.2.4` | Headless sorting, filtering, pagination, and row models for complex admin grids.                                                 |
| `@tanstack/react-query`   |      `5.102.8` | Client cache, mutation, retry, and invalidation state for interactive dashboard and upload workflows.                            |

## Development dependencies

| Package                            | Declared version | Purpose                                                                                                                 |
| ---------------------------------- | ---------------: | ----------------------------------------------------------------------------------------------------------------------- |
| `typescript`                       |         `^5.9.3` | Strict static checking and build-time type analysis.                                                                    |
| `eslint`                           |        `^9.39.5` | JavaScript and TypeScript lint engine.                                                                                  |
| `eslint-config-next`               |         `16.3.5` | Next.js and React lint rules aligned with the framework version.                                                        |
| `@types/node`                      |        `^24.1.0` | Node.js 24 API declarations.                                                                                            |
| `@types/react`                     |        `^19.3.0` | React 19 declarations.                                                                                                  |
| `@types/react-dom`                 |        `^19.3.0` | React DOM 19 declarations.                                                                                              |
| `@types/leaflet`                   |         `1.9.22` | Leaflet declarations for map components and geographic data.                                                            |
| `@types/sanitize-html`             |         `2.16.1` | Type declarations for the server-side sanitizer.                                                                        |
| `prettier`                         |          `3.9.6` | Deterministic formatting for source, configuration, styles, and documentation.                                          |
| `eslint-config-prettier`           |         `10.1.8` | Disables ESLint formatting rules that conflict with Prettier.                                                           |
| `@typescript-eslint/eslint-plugin` |         `8.70.0` | Type-aware promise, switch exhaustiveness, and type-import rules used directly by ESLint.                               |
| `@typescript-eslint/parser`        |         `8.70.0` | Supplies TypeScript project-service type information to ESLint.                                                         |
| `vite`                             |          `8.3.0` | Version-pinned transform/runtime foundation used by Vitest and its plugins.                                             |
| `vitest`                           |          `5.0.0` | Fast unit, component, contract, and integration test runner.                                                            |
| `@vitest/coverage-v8`              |          `5.0.0` | Native V8 coverage collection with text, HTML, and LCOV reports.                                                        |
| `@vitejs/plugin-react`             |          `6.1.1` | React JSX transformation for component tests.                                                                           |
| `jsdom`                            |         `29.1.1` | Browser DOM simulation for React component tests; selected over 30.x to support the full declared Node 24 engine range. |
| `@testing-library/dom`             |         `10.4.2` | Accessible, user-oriented DOM queries used by Testing Library adapters.                                                 |
| `@testing-library/react`           |         `16.3.3` | React 19 component rendering and interaction test utilities.                                                            |
| `@testing-library/jest-dom`        |          `7.0.1` | Semantic DOM matchers integrated with Vitest assertions.                                                                |
| `@testing-library/user-event`      |         `14.6.7` | Realistic keyboard, pointer, and form interactions for component tests.                                                 |
| `msw`                              |         `2.15.0` | Network-level mocks for deterministic payment, messaging, and other external HTTP contracts.                            |
| `mongodb-memory-server-core`       |         `11.2.0` | On-demand isolated MongoDB for repository integration tests without install-time binary downloads.                      |
| `@playwright/test`                 |         `1.63.0` | Browser-level customer, dashboard, and async Server Component journeys.                                                 |
| `@axe-core/playwright`             |         `4.13.0` | Automated WCAG rule scans within Playwright journeys.                                                                   |
| `husky`                            |          `9.1.7` | Repository-owned native Git hook setup.                                                                                 |
| `lint-staged`                      |         `17.5.1` | Runs formatting and lint fixes only against files staged for commit.                                                    |

## Integration rules

- Initialize MUI through `@mui/material-nextjs` at the App Router root; create separate LTR and RTL
  Emotion caches when theme and localization integration is implemented.
- Create one Query Client per browser request lifecycle and keep query keys in feature-owned modules.
- Keep TanStack Table pagination, sorting, and filtering server-driven for large admin collections.
- Initialize Tiptap in client components with SSR-safe rendering disabled until hydration; render saved
  documents through the static renderer for public pages.
- Import Leaflet and its stylesheet only inside client-side map features because Leaflet requires the
  browser DOM.
- Keep Mongoose connection code and all native/security/storage packages under `src/server`.

## Primary references

- [MUI installation](https://mui.com/material-ui/getting-started/installation/)
- [MUI integration with Next.js](https://mui.com/material-ui/integrations/nextjs/)
- [Tiptap React installation](https://tiptap.dev/docs/editor/getting-started/install/react)
- [Mongoose with Next.js](https://mongoosejs.com/docs/nextjs.html)
- [Vitest guide](https://vitest.dev/guide/)
- [Playwright test documentation](https://playwright.dev/docs/intro)
- [Testing Library introduction](https://testing-library.com/docs/)
- [MSW documentation](https://mswjs.io/docs/)
- [Husky setup](https://typicode.github.io/husky/get-started.html)
- [lint-staged documentation](https://github.com/lint-staged/lint-staged)
- [typescript-eslint typed linting](https://typescript-eslint.io/getting-started/typed-linting/)
- [Next.js server/client component boundaries](https://nextjs.org/docs/app/getting-started/server-and-client-components)
