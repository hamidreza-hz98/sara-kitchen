# Directory structure

Sara Kitchen keeps routes in `src/app` and shared application code in sibling folders. This follows the installed Next.js App Router guidance while making ownership explicit.

| Path              | Responsibility                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------- |
| `src/app`         | Route groups, layouts, pages, Route Handlers, metadata, and route-level loading/error UI. |
| `src/components`  | Reusable React UI and design-system components.                                           |
| `src/hooks`       | Shared client-side React hooks.                                                           |
| `src/lib`         | Framework-agnostic utilities and infrastructure adapters.                                 |
| `src/providers`   | Application-level React provider composition.                                             |
| `src/theme`       | Design tokens, Material UI theme, Emotion, and direction-aware styling.                   |
| `src/validations` | Shared boundary-validation schemas and stable issue contracts.                            |
| `src/types`       | Cross-cutting serializable TypeScript contracts not owned by a domain module.             |
| `src/constants`   | Stable project-wide constants such as supported locales and currency.                     |
| `src/server`      | Modular-monolith domain modules and server-only infrastructure.                           |
| `src/locales`     | Application interface message catalogs and localization configuration.                    |
| `public`          | Version-controlled static assets served from the site root.                               |
| `tests`           | Cross-feature integration, contract, end-to-end, fixture, and test-helper code.           |
| `docs`            | Architecture, decisions, setup, operations, and acceptance records.                       |

## Placement rules

1. Put code in the narrowest location that owns it.
2. Keep route-only UI beside the route and promote it to `src/components` only after genuine reuse appears.
3. Keep business rules inside the owning server module, not in pages, handlers, hooks, or generic utilities.
4. Do not create a public route accidentally: a folder under `src/app` becomes routable only through Next.js route files such as `page.tsx` or `route.ts`.
5. Use route groups for layout/organization without changing URLs and private folders for non-routable route implementation details when beneficial.
6. Keep `public`, configuration, environment files, and package metadata at the repository root as required by Next.js.
7. Avoid empty folders, placeholder exports, and catch-all files whose ownership is unclear.
