# ADR-0007 — Deploy serverless compute with external EU data services

- Status: Accepted
- Date: 2026-09-14
- Owners: Sara Kitchen engineering

## Context

The requested production architecture is a serverless-compatible Next.js modular monolith. It serves
customers in Porto, receives MB Way and WhatsApp/provider callbacks, performs authenticated dashboard
work, uses native Node.js packages, and depends on durable MongoDB and MinIO state.

Vercel has first-class Next.js rendering, Route Handler, streaming, CDN, preview, and function support,
but function filesystems are not durable object storage. MongoDB and MinIO need persistent external
services. Customer/order/address data should remain in the European Economic Area and services should
be geographically close enough to avoid excessive request latency.

## Decision

Use a split production target:

1. Deploy the single Next.js application to Vercel using the Node.js Function runtime in the nearest
   suitable EEA region available to the selected plan.
2. Deploy MongoDB on MongoDB Atlas in an EEA region close to application compute, with production-grade
   authentication, network restrictions, encryption, automated backups, and tested restore procedures.
3. Deploy MinIO outside Vercel on persistent EU infrastructure with TLS, private networking or strict
   ingress rules, durable replicated storage appropriate to the selected service level, monitoring,
   backups, and tested restores.

Additional constraints:

- Use separate Vercel projects or isolated environment configuration for preview/staging and production.
  Never connect preview deployments to production MongoDB, MinIO, payment, or messaging credentials.
- Build and execute server code in the Node.js runtime. Confirm Argon2, Sharp, Mongoose, and MinIO client
  packaging in preview before launch; do not move their import graph to Edge middleware/functions.
- Reuse cached module-scope database/provider clients safely across warm invocations and bound connection
  pools for serverless concurrency. Services must tolerate cold starts and multiple concurrent instances.
- Keep all durable state outside function memory and filesystem. `/tmp` is scratch space only and must not
  become a queue, upload store, session store, or source of truth.
- Locate application compute, Atlas, and MinIO together in the EEA where practical. Record selected
  regions and data-processing settings in the deployment runbook before production data entry.
- Terminate public HTTPS at managed/provider edges. MinIO is not anonymously public; media delivery uses
  controlled presigned access and an optional CDN with an explicit cache/purge policy.
- Payment and messaging webhooks use stable HTTPS Route Handlers, provider signature verification,
  idempotency keys, durable state before side effects, and retry-safe responses.
- Scheduled reconciliation/cleanup may use Vercel Cron to invoke protected idempotent handlers. Long or
  CPU-heavy media work must move to a durable queue/worker target rather than exceeding Function limits.
- Production promotion requires the repository verification gate, preview smoke tests, environment
  validation, migration/index plans, backup/rollback evidence, observability, and owner approval.
- Infrastructure configuration must remain portable enough to self-host the Next.js application if cost,
  limits, region availability, or native dependency behavior invalidates Vercel.

## Alternatives considered

### Self-host Next.js, MongoDB, and MinIO on one VPS

Rejected for launch because it creates a single failure domain and transfers patching, TLS, scaling,
backups, deployment, and recovery ownership to a small team. It remains a portability fallback, not the
default production topology.

### Deploy everything in one Kubernetes or container platform

Rejected as premature operational complexity for MVP traffic and team size. It would require cluster,
ingress, secrets, storage, observability, and upgrade operations before delivering product value.

### Use Vercel for compute and filesystem/object state

Rejected because Vercel Functions expose read-only deployment files plus limited temporary scratch
space, not durable shared storage.

### Replace MongoDB/MinIO with Vercel-native data products

Rejected because MongoDB and a MinIO provider are explicit product architecture requirements. Such a
change would require new data/provider ADRs and migration plans.

### Deploy compute outside the EEA while data remains in Europe

Rejected by default because it increases latency and complicates data-transfer/privacy analysis without
a demonstrated customer-performance benefit.

## Consequences

### Positive

- Vercel supplies first-class Next.js deployment, previews, CDN delivery, streaming, and automatic
  function scaling with little platform operation.
- Atlas owns database availability/backups while preserving Mongoose/MongoDB contracts.
- Durable media stays on infrastructure designed for object storage.
- EEA placement supports low latency to Porto and a clearer data-residency posture.
- Provider boundaries and one deployable application preserve a self-hosting escape path.

### Costs and risks

- The system spans three providers and needs coordinated secrets, regions, monitoring, incident response,
  backups, and cost tracking.
- Serverless connection bursts, cold starts, duration/body limits, and native binary packaging require
  load and preview testing.
- MinIO operations remain the team's responsibility and carry maintenance/sustainability risk.
- Cross-provider network latency and egress can affect checkout and media cost/performance.
- Some background workloads may require a future durable queue and worker platform.

## Revisit when

- Measured Vercel limitations, cost, native dependency packaging, or regional constraints affect service
  objectives.
- Traffic or media processing justifies dedicated workers, queues, or independently scalable services.
- MinIO maintenance risk requires a managed compatible replacement.
- Legal/privacy review changes residency, processing, retention, or provider requirements.
- The team can operate a consolidated container platform more reliably or economically.

## References

- [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs)
- [Vercel Function runtimes and filesystem](https://vercel.com/docs/functions/runtimes)
- [MongoDB Atlas cloud providers and regions](https://www.mongodb.com/docs/atlas/cloud-providers-regions/)
- [Next.js self-hosting considerations](https://nextjs.org/docs/app/guides/self-hosting)
- [MinIO object-storage decision](./0006-minio-object-storage.md)
