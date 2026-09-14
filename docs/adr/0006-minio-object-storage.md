# ADR-0006 — Store media in private MinIO object storage

- Status: Accepted
- Date: 2026-09-14
- Owners: Sara Kitchen engineering

## Context

Administrators upload images, videos, PDFs, and future media in bulk. Images require validation,
compression, and WebP variants. Categories, dishes, ingredients, blogs, settings, and SEO reference
media while the Next.js production compute target has no durable writable filesystem.

Media binary lifecycle, authorization, metadata, transformations, and entity references differ from
ordinary MongoDB documents. The requested backend must support MinIO while avoiding provider details in
domain modules.

## Decision

Use MinIO-compatible S3 object storage behind the Media module's provider interface, with MongoDB
holding metadata and references rather than binary payloads.

- Store opaque object keys, bucket, version/checksum, MIME type, byte size, dimensions/duration where
  known, variants, ownership, lifecycle state, and audit timestamps in Media documents. Never persist a
  deployment-specific public URL as the identity.
- Keep buckets private. Browsers receive short-lived, purpose-limited presigned URLs or an authorized
  streaming response; anonymous bucket access is forbidden.
- Generate server-owned, non-guessable keys with environment/entity-neutral prefixes. Never trust a
  user filename as a path; retain a separately sanitized display filename.
- Validate declared and detected type, size, dimensions, and policy before finalization. Reject
  executable/polyglot content and ensure authorization is checked both when initiating and completing
  uploads.
- Prefer presigned direct upload for large payloads so serverless functions do not proxy whole videos
  or PDFs. Finalization verifies the object exists, expected size/checksum matches, and metadata is
  committed idempotently.
- Process supported raster images through Sharp in the Node.js runtime, apply orientation, strip unsafe
  metadata, constrain dimensions, compress, and create WebP delivery variants. Videos/PDFs are not sent
  through Sharp.
- Treat object creation and MongoDB metadata as a recoverable workflow, not a distributed transaction.
  Use idempotency keys and reconciliation to clean abandoned temporary objects or repair missing
  metadata.
- Entities store opaque Media identifiers and resolve authorized DTOs through the Media public API.
  They never call the MinIO client or access Media models directly.
- Prevent physical deletion while live references exist. Normal deletion first marks media unavailable;
  delayed hard deletion and version/backup retention follow an explicit policy.
- The MinIO client is configured only through validated server environment values. Credentials never
  reach Client Components, logs, generated URLs, or repository documents.
- Local development uses the Compose stack in `docs/local-infrastructure.md`. Production MinIO runs as
  an external persistent EU service with TLS, monitoring, backups, and restore tests per ADR-0007.

## Alternatives considered

### Store binaries in MongoDB/GridFS

Rejected because it couples database backup/throughput to large media, complicates CDN/object delivery,
and does not meet the requested MinIO provider capability.

### Store uploads on the Next.js filesystem

Rejected because serverless filesystems are ephemeral/read-only outside scratch space and do not provide
durable shared storage.

### Expose a public bucket

Rejected because drafts, deleted assets, PDFs, and administration media require authorization and
revocable access.

### Bind directly to one hosted S3 vendor

Rejected for the primary design because MinIO is required and an S3-compatible provider port preserves
deployment choice. Provider-specific optimization can be added behind the same Media contract.

### Outsource transformation and delivery to a media SaaS

Deferred. It could reduce operational load but adds cost, vendor coupling, privacy review, and a second
source of asset truth.

## Consequences

### Positive

- Binary storage scales and backs up independently from MongoDB.
- Private objects, presigned access, and opaque references support draft and authenticated media.
- An S3-compatible port keeps domain code independent from deployment details.
- Direct uploads reduce serverless bandwidth and duration pressure.

### Costs and risks

- MinIO is another stateful production service requiring upgrades, TLS, monitoring, backup, and restore
  ownership; its community repository is archived and must be reviewed for security sustainability.
- Object storage and MongoDB cannot commit atomically, requiring idempotency and reconciliation.
- Image transformation consumes CPU/memory and must respect function limits.
- Presigned upload completion and content verification add workflow complexity.
- Cache invalidation requires immutable keys or explicit versioning.

## Revisit when

- The MinIO security/maintenance posture no longer meets production requirements.
- Transformation workloads exceed serverless limits or need queued workers.
- A managed S3-compatible service materially improves availability/cost without breaking the provider
  contract.
- Media volume requires CDN, replication, lifecycle tiers, or malware scanning beyond the MVP design.

## References

- [Local MongoDB and MinIO operations](../local-infrastructure.md)
- [MinIO JavaScript client](https://github.com/minio/minio-js)
- [Vercel Function filesystem behavior](https://vercel.com/docs/functions/runtimes#file-system-support)
