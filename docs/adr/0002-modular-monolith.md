# ADR-0002 — Build the backend as a modular monolith

- Status: Accepted
- Date: 2026-09-14
- Owners: Sara Kitchen engineering

## Context

The backend contains strongly related domains: authentication, administrators, customers, sessions,
media, categories, dishes, ingredients, carts, addresses, orders, transactions, contacts, blogs, SEO,
settings, logs, and analytics. Checkout crosses several domains and must preserve pricing, address,
customer, payment, and dish history consistently.

The initial team and traffic do not justify independent services, distributed deployment, message
brokers, duplicated observability, or cross-service consistency. An unstructured monolith, however,
would permit direct model access and cycles that make later extraction unsafe.

## Decision

Build one deployable Next.js application containing an explicitly modular backend under
`src/server/modules`.

- Each domain owns its models, collections, repositories, policies, validation, mapping, tests, and
  service use cases.
- A module's root `index.ts` is its only public API. Other modules cannot import its model, repository,
  or internal files.
- Cross-module dependencies must be declared in `docs/architecture.md`, point in one direction, and
  remain acyclic. The executable boundary checker enforces the rule.
- Public APIs exchange explicit commands, queries, opaque identifiers, and serializable DTOs—not
  Mongoose documents or repositories.
- The workflow owner coordinates cross-module work through public APIs. MongoDB sessions may be passed
  through an explicit transaction context when atomicity across owned collections is required.
- Historical documents store immutable snapshots instead of populating current foreign models. Orders
  snapshot customer, address, dish translation, quantity, price, discount, fee, tax, and total data.
- Durable business state is committed before external side effects. Payment callbacks, notifications,
  and retries must be idempotent; use an outbox when delivery consistency becomes material.
- Logs receive safe audit events through a public contract or injected port. Business modules never
  write directly to the logs collection.
- One module can later be extracted only behind its established public contract and after ownership,
  transactions, events, operations, and latency are explicitly redesigned.

## Alternatives considered

### Microservices from the beginning

Rejected because operational and distributed-consistency costs outweigh isolation benefits at MVP
scale. Checkout and content workflows would require premature remote orchestration.

### Traditional technical layers shared by every feature

Rejected because global model/service/controller folders make domain ownership ambiguous and invite
cross-feature persistence access.

### Unrestricted feature folders

Rejected because folder names alone do not prevent cycles or private model imports. Boundaries must be
documented and executable.

## Consequences

### Positive

- One build and deployment keep development and operations economical.
- Domain ownership, public APIs, and tests localize change and make future extraction possible.
- In-process calls support straightforward transactions and low-latency checkout orchestration.
- Shared platform concerns can be reused without duplicating services.

### Costs and risks

- A faulty or expensive module can affect the whole deployment.
- The application scales as a unit even if only one capability is hot.
- Developers must resist convenient private imports and overly broad public APIs.
- MongoDB cross-module transactions and side effects still require explicit failure design.

Automated import checks, declared dependency maps, immutable snapshots, and module-owned tests reduce
these risks.

## Revisit when

- A module has independently measured scale, availability, security, or release requirements.
- Team ownership requires separate deployment autonomy.
- A reliable event boundary and operational capacity exist to support extraction.

## References

- [System boundaries and module dependency map](../architecture.md)
- [Module blueprint](../../src/server/modules/_template/README.md)
