# Sara Kitchen architecture

## System shape

Sara Kitchen is a Next.js App Router application with a serverless-compatible modular-monolith backend in the same deployable unit. The browser, Server Components, Server Actions when appropriate, Route Handlers, scheduled jobs, and provider webhooks all reach the same domain services rather than duplicating business rules.

```text
UI / external caller
        │
        ▼
Next.js page, action, route handler, job, or webhook adapter
        │  parse request and resolve actor
        ▼
Public module API (`src/server/modules/<module>/index.ts`)
        │
        ▼
validation → policy → service → repository → model/schema
                         │
                         └── mapper → explicit serializable DTO
```

Server Components call public module services directly. They do not make HTTP requests back into this Next.js process. Route Handlers are transport adapters for client/browser calls, uploads, webhooks, and external integrations; they do not become a second business layer.

## Boundary rules

1. Each directory under `src/server/modules` owns one domain capability and its persistence collections.
2. A module’s root `index.ts` is its only public import surface.
3. Cross-module imports must use `@/server/modules/<module>` and must be declared in the dependency table below.
4. Relative traversal from one module into a sibling is forbidden.
5. Models, Mongoose schemas, repository implementations, mappers, policy implementations, validation internals, and test helpers are private to their owner module.
6. A module never calls another module’s database model, collection, or repository directly. It calls a public query/command contract or stores an opaque identifier/snapshot.
7. Public module APIs expose use cases plus serializable inputs/DTOs. They never expose Mongoose documents, secrets, raw provider payloads, or persistence sessions unintentionally.
8. Cyclic imports are forbidden. When two domains reference one another, assign orchestration to one owner, store opaque references, use immutable snapshots, or publish an application event rather than importing both ways.
9. Cross-cutting request correlation and audit behavior are injected or invoked through public contracts; domain modules do not reach into Logs persistence.
10. The executable boundary checker and its tests are required verification for all source changes.
11. Top-level source layers follow the dependency directions documented in
    [`code-quality.md`](./code-quality.md); reusable/shared layers never import application routes or
    server infrastructure.
12. Client Components cannot import server-only modules. Dedicated `use server` action entrypoints
    are the explicit framework-supported exception.

Run:

```powershell
pnpm check:boundaries
pnpm test:boundaries
```

## Standard module shape

The canonical blueprint is `src/server/modules/_template/README.md`.

- `model/`: private Mongoose schema/model registration and persistence types.
- `repository/`: private database queries and persistence implementation.
- `service/`: business use cases, invariants, and transaction boundaries.
- `policy/`: authentication, permission, and ownership decisions.
- `validation/`: parsing and normalization of untrusted input.
- `mapper/`: persistence/domain/public DTO conversion.
- `__tests__/`: focused unit and module integration tests.
- `index.ts`: deliberately small public module API.

Layers materialize when real behavior is implemented. Empty directories, placeholder classes, and fake CRUD abstractions are not architecture. A new layer file must contain a real contract, invariant, query, mapping, or test.

## Module ownership and allowed dependencies

Dependencies point from consumer to provider. “None” means the module accepts opaque identifiers/context and has no domain-module import.

| Module       | Owns                                                                | May depend on public APIs of                      |
| ------------ | ------------------------------------------------------------------- | ------------------------------------------------- |
| Auth         | Authentication orchestration and password/account flows             | Admins, Customers, Sessions                       |
| Admins       | Administrator identity, credentials, roles, status                  | None                                              |
| Customers    | Customer identity, profile, credentials, consent/privacy state      | None                                              |
| Sessions     | Hashed sessions, device metadata, expiry/revocation                 | None                                              |
| Media        | Upload metadata, storage coordination, variants, usage/deletion     | None                                              |
| Categories   | Category content, slug, status, ordering                            | Media                                             |
| Ingredients  | Ingredient content, allergens, status                               | Media                                             |
| Dishes       | Catalog content, pricing source, availability, lead time, relations | Categories, Ingredients, Media                    |
| Addresses    | Customer delivery addresses and ownership                           | Customers                                         |
| Carts        | Cart identity/items, merge, pricing and availability coordination   | Addresses, Customers, Dishes                      |
| Transactions | Payment state/events, idempotency, webhooks, reconciliation         | Customers                                         |
| Orders       | Checkout, immutable snapshots, code/status/history                  | Addresses, Carts, Customers, Dishes, Transactions |
| Contacts     | Contact submissions, workflow and retention                         | None                                              |
| Blogs        | Articles, publishing, relations and views                           | Admins, Dishes, Media                             |
| SEO          | Static/entity metadata, sitemap and structured-data inputs          | Blogs, Categories, Dishes, Media                  |
| Settings     | Versioned site, content, delivery and notification configuration    | Blogs, Categories, Dishes, Media                  |
| Logs         | Append-only audit events and authorized reads                       | None                                              |
| Analytics    | Derived dashboard/report queries and rollups                        | Customers, Dishes, Logs, Orders                   |

## Reference and snapshot policy

- MongoDB references are identifiers, not permission to populate another module’s model directly.
- The owner module validates or resolves a reference through its public API where current existence/state matters.
- Orders copy immutable customer, address, dish, translation, price, discount, fee, tax, and total snapshots. Historical truth must survive later edits or deletion/anonymization.
- Logs store opaque actor/resource identifiers and safe snapshots without importing identity/resource models.
- Transactions store opaque order identifiers so provider callbacks cannot create a Transactions → Orders → Transactions import cycle. Order/payment orchestration calls both public APIs from the owning workflow.

## Data and transaction ownership

- A repository accesses only collections owned by its module.
- Multi-module workflows are coordinated by the module named as owner in the table or by a future application orchestration service documented in an ADR.
- MongoDB transactions are opened at the workflow boundary and passed through explicit infrastructure contracts; repositories do not silently create nested transactions.
- Side effects such as WhatsApp/email notifications occur after durable state is recorded and use idempotent event/outbox processing where consistency matters.

## Evolution rule

Changing ownership, adding a dependency, or exposing a new public contract requires all of the following in the same commit:

1. update this document and the affected module README;
2. update the executable dependency map;
3. add or update boundary tests;
4. confirm no dependency cycle is introduced;
5. run lint, typecheck, boundary checks/tests, and the production build.
