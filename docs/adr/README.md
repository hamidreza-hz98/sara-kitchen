# Architecture decision records

Architecture Decision Records (ADRs) capture choices that constrain Sara Kitchen implementation and
operations. They explain why a decision exists, not merely what the current code happens to do.

## Status model

- **Proposed:** under review and not yet binding.
- **Accepted:** binding for new work.
- **Superseded:** replaced by a later ADR; retained for history.
- **Deprecated:** should not be used for new work but has no replacement yet.

Accepted ADRs are immutable except for typo/link corrections. Change a decision by adding a new ADR,
marking the old record superseded, and linking both records. Implementation must update relevant ADRs
in the same change when it reveals that a recorded decision is inaccurate.

## Decision index

| ADR                                            | Decision                                                 | Status   |
| ---------------------------------------------- | -------------------------------------------------------- | -------- |
| [0001](./0001-nextjs-app-router.md)            | Use the Next.js App Router                               | Accepted |
| [0002](./0002-modular-monolith.md)             | Build the backend as a modular monolith                  | Accepted |
| [0003](./0003-embedded-translations.md)        | Embed typed translation arrays in content aggregates     | Accepted |
| [0004](./0004-custom-principal-sessions.md)    | Use custom, audience-separated database sessions         | Accepted |
| [0005](./0005-integer-money.md)                | Represent money as integer EUR cents                     | Accepted |
| [0006](./0006-minio-object-storage.md)         | Store media in private MinIO object storage              | Accepted |
| [0007](./0007-production-deployment-target.md) | Deploy serverless compute with external EU data services | Accepted |
| [0008](./0008-transaction-boundaries.md)       | Keep checkout and payment state atomic in MongoDB        | Accepted |

Run `pnpm test:adr` to verify the inventory, metadata, required sections, and index links.
