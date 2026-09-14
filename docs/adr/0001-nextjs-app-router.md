# ADR-0001 — Use the Next.js App Router

- Status: Accepted
- Date: 2026-09-14
- Owners: Sara Kitchen engineering

## Context

Sara Kitchen combines a localized storefront, customer profile, three-step checkout, content pages,
SEO documents, an administration dashboard, HTTP integrations, and backend business logic in one
Next.js codebase. The UI/UX is already designed. The application needs server rendering for public
discovery, authenticated dynamic views, interactive client islands, payment and messaging webhooks,
and serverless-compatible request handlers.

Next.js offers both the older Pages Router and the App Router. Mixing them would create two routing,
data-loading, metadata, error, and layout models. A client-only SPA would also discard useful server
rendering and ship unnecessary data-access orchestration to browsers.

## Decision

Use only the Next.js App Router under `src/app`.

- Layouts and pages are Server Components by default. Add `"use client"` only at the smallest leaf
  boundary that requires state, events, effects, browser storage, maps, editors, or other browser APIs.
- Use route groups to organize storefront, customer, authentication, and dashboard concerns without
  adding artificial URL segments. The `/dashboard` and `/profile` URL contracts remain explicit.
- Server Components call public modular-monolith services directly; they never make HTTP calls back
  into the same Next.js deployment.
- Route Handlers are transport adapters for browser APIs, provider webhooks, uploads, downloads, and
  callers outside the React tree. They validate transport input and delegate business rules.
- Server Actions may support first-party form mutations where they materially simplify progressive
  enhancement. They are not a second service layer and must apply the same validation and policy as
  Route Handlers.
- Mongoose, Argon2, Sharp, and MinIO code uses the Node.js runtime. Edge-compatible code must not
  import these packages or server modules that depend on them.
- Use App Router metadata, sitemap, robots, loading, error, and not-found conventions. Locale is not a
  route segment; request locale negotiation follows ADR-0003.
- Keep request adapters thin and framework-specific. Domain services and DTOs must remain testable
  without rendering Next.js components.

## Alternatives considered

### Pages Router

Rejected because it would use the older data-fetching/layout model and forgo the chosen Server
Component-first architecture. Maintaining both routers would duplicate conventions.

### Client-rendered single-page application plus API

Rejected because public menu, dish, category, and blog pages benefit from server-rendered content and
metadata. It would also ship more JavaScript and introduce an unnecessary internal HTTP boundary.

### Separate frontend and backend repositories

Rejected for the MVP because shared types, validation, deployment coordination, and a small team favor
one deployable unit. A public API can still be extracted later behind existing module contracts.

## Consequences

### Positive

- Nested layouts, streaming, metadata, and server rendering match the storefront and dashboard.
- Server Components reduce browser JavaScript and keep credentials/data access on the server.
- Route Handlers and Server Actions reuse the same backend services and validation.
- One routing model reduces cognitive overhead and migration work.

### Costs and risks

- Server/client boundaries require discipline; invalid imports can leak code or fail builds.
- App Router caching and dynamic rendering must be chosen explicitly to prevent stale personalized
  content.
- Native Node packages prevent affected routes from using the Edge runtime.
- Framework upgrades can alter conventions and must be reviewed against installed Next.js docs.

The executable import-boundary checker, `server-only` guards, type-aware linting, and browser tests
mitigate these risks.

## Revisit when

- A stable external API must deploy independently from the storefront.
- A route has a measured need for an Edge runtime and can be isolated from Node-only dependencies.
- Next.js supersedes App Router with a migration path that materially improves this system.

## References

- [Next.js App Router](https://nextjs.org/docs/app)
- [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers)
